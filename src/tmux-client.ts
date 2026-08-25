import { spawn, execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'
import { decodeControlOutput } from './decode.ts'
import { parseLayout, type PaneRect } from './layout.ts'
import type { SessionInfo, WindowInfo } from './types.ts'

const execFileAsync = promisify(execFile)

export interface TmuxPane {
  id: string
  index: number
  title: string
  role: string
  left: number
  top: number
  width: number
  height: number
  active: boolean
}

export interface TmuxSnapshot {
  session: string
  windowId: string
  windowName: string
  cols: number
  rows: number
  panes: TmuxPane[]
  sessions: SessionInfo[]
  windows: WindowInfo[]
  /** Other attached clients that participate in window sizing (no ignore-size). */
  viewers: number
}

/**
 * The control channel. tmux -C works over plain pipes (verified on 3.7b):
 * no PTY, no echo, no DCS wrapper, clean LF-framed lines.
 */
export interface ControlTransport {
  write(data: string): void
  kill(): void
  onData(fn: (chunk: string) => void): void
  onStderr(fn: (chunk: string) => void): void
  onExit(fn: (code: number | null) => void): void
}

export type SpawnTransport = (tmuxBin: string, args: string[]) => ControlTransport

interface Pending {
  line: string
  settled: boolean
  resolve: (text: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface OpenBlock {
  num: string
  lines: string[]
}

interface Events {
  snapshot: [TmuxSnapshot]
  output: [paneId: string, data: string]
  history: [paneId: string, data: string]
  error: [message: string]
  /** Fired only for unexpected exits — a requested detach never emits this. */
  exit: [code: number | null]
}

export interface TmuxControlOptions {
  spawnTransport?: SpawnTransport
  listSessions?: (tmuxBin: string) => Promise<SessionInfo[]>
  /** Per-command reply timeout; a timed-out command fails without wedging the queue. */
  commandTimeoutMs?: number
}

export class TmuxControlClient extends EventEmitter<Events> {
  private transport: ControlTransport | null = null
  private buf = ''
  private block: OpenBlock | null = null
  private queue: Pending[] = []
  private snapshot: TmuxSnapshot | null = null
  private sessionName = ''
  private clientName = ''
  private stderrTail = ''
  private requestedDetach = false
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  readonly tmuxBin: string
  private readonly spawnTransport: SpawnTransport
  private readonly listSessions: (tmuxBin: string) => Promise<SessionInfo[]>
  private readonly commandTimeoutMs: number

  constructor(tmuxBin = 'tmux', options: TmuxControlOptions = {}) {
    super()
    this.tmuxBin = tmuxBin
    this.spawnTransport = options.spawnTransport ?? defaultTransport
    this.listSessions = options.listSessions ?? listSessionsCli
    this.commandTimeoutMs = options.commandTimeoutMs ?? 5000
  }

  get attached(): boolean {
    return this.transport !== null
  }

  /** Name of the session this control client is attached to ('' when detached). */
  get session(): string {
    return this.transport === null ? '' : this.sessionName
  }

  currentSnapshot(): TmuxSnapshot | null {
    return this.snapshot
  }

  async attach(session: string): Promise<void> {
    this.detach()
    this.requestedDetach = false
    this.sessionName = session
    const transport = this.spawnTransport(this.tmuxBin, [
      '-C',
      'attach-session',
      '-f',
      'ignore-size',
      '-t',
      `=${session}`,
    ])
    this.transport = transport
    // Every callback is gated on transport identity: a replaced or detached
    // client may still flush data/exit during its grace period, and that must
    // never leak into the successor's state.
    transport.onData((chunk) => {
      if (this.transport === transport) this.push(chunk)
    })
    transport.onStderr((chunk) => {
      if (this.transport === transport) this.stderrTail = (this.stderrTail + chunk).slice(-500)
    })
    transport.onExit((code) => {
      if (this.transport !== transport) return
      const detail = this.stderrTail.trim()
      this.transport = null
      this.failAll(new Error(detail || 'tmux control client exited'))
      this.snapshot = null
      this.emit('exit', code)
    })
    try {
      this.clientName = (await this.command("display-message -p '#{client_name}'")).trim()
      await this.refreshSnapshot()
      await this.captureVisible()
    } catch (err) {
      const detail = this.stderrTail.trim()
      this.detach()
      throw detail ? new Error(detail) : err
    }
  }

  detach(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = null
    const transport = this.transport
    if (transport !== null) {
      this.requestedDetach = true
      this.transport = null
      try { transport.write('detach-client\n') } catch { /* already gone */ }
      // The %exit handshake normally lands well within the grace period.
      setTimeout(() => { try { transport.kill() } catch { /* already gone */ } }, 250)
    }
    this.buf = ''
    this.block = null
    this.stderrTail = ''
    this.failAll(new Error('detached'))
    this.snapshot = null
  }

  /**
   * Send raw input bytes to a pane. Everything is hex-encoded through
   * `send-keys -H` so CR/LF and arbitrary bytes can never split the
   * line-framed control protocol (a quoted literal CR does — verified).
   */
  async sendKeys(paneId: string, data: string): Promise<void> {
    if (data === '') return
    const bytes = Buffer.from(data, 'utf8')
    const chunkSize = 128
    for (let off = 0; off < bytes.length; off += chunkSize) {
      const hex: string[] = []
      for (const byte of bytes.subarray(off, off + chunkSize)) {
        hex.push(byte.toString(16).padStart(2, '0'))
      }
      await this.command(`send-keys -t ${quote(paneId)} -H ${hex.join(' ')}`)
    }
  }

  async selectPane(paneId: string): Promise<void> {
    await this.command(`select-pane -t ${quote(paneId)}`)
    this.scheduleRefresh()
  }

  async selectDir(dir: 'L' | 'R' | 'U' | 'D'): Promise<void> {
    await this.command(`select-pane ${{ L: '-L', R: '-R', U: '-U', D: '-D' }[dir]}`)
    this.scheduleRefresh()
  }

  async selectWindow(windowId: string): Promise<void> {
    await this.command(`select-window -t ${quote(windowId)}`)
    await this.refreshSnapshot()
    await this.captureVisible()
  }

  async captureVisible(): Promise<void> {
    const panes = this.snapshot?.panes ?? []
    for (const pane of panes) {
      let text = ''
      try {
        text = await this.command(`capture-pane -epJ -t ${quote(pane.id)} -S -200`)
      } catch {
        continue
      }
      const lines = text.split('\n')
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
      if (lines.length === 0) continue
      this.emit('history', pane.id, `${lines.join('\r\n')}\r\n`)
    }
  }

  async zoom(paneId?: string): Promise<void> {
    const target = paneId ?? this.snapshot?.panes.find((p) => p.active)?.id
    if (target === undefined) return
    await this.command(`resize-pane -Z -t ${quote(target)}`)
    await this.refreshSnapshot()
  }

  async split(dir: 'h' | 'v'): Promise<void> {
    await this.command(`split-window ${dir === 'h' ? '-h' : '-v'}`)
    await this.refreshSnapshot()
  }

  async killPane(paneId?: string): Promise<void> {
    // Guard the whole session (not just the current window): never kill the
    // last live pane out from under iTerm or other seats.
    const total = await this.command("list-panes -s -F 'x'")
    if (total.split('\n').filter((line) => line.trim() !== '').length <= 1) {
      throw new Error('refusing to kill the last pane of the session')
    }
    if (paneId) await this.command(`kill-pane -t ${quote(paneId)}`)
    else await this.command('kill-pane')
    await this.refreshSnapshot()
  }

  /**
   * Count the other attached clients that take part in window sizing.
   * `ignore-size` clients (this one, other docks) don't count; anything else —
   * a plain `tmux attach` or an iTerm2 `-CC` seat — does.
   */
  async countViewers(): Promise<number> {
    // Scope to our session — a bare list-clients reports the whole server.
    const raw = await this.command(`list-clients -t ${quote(`=${this.sessionName}`)} -F '#{client_name}\t#{client_flags}'`)
    let viewers = 0
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue
      const [name, flags] = line.split('\t')
      if (name === this.clientName) continue
      if ((flags ?? '').split(',').includes('ignore-size')) continue
      viewers += 1
    }
    return viewers
  }

  /** Toggle whether tmux ignores this client when computing window sizes. */
  async setIgnoreSize(on: boolean): Promise<void> {
    await this.command(`refresh-client -f ${on ? '' : '!'}ignore-size`)
  }

  /** Dictate the window size (only effective while ignore-size is off). */
  async setClientSize(cols: number, rows: number): Promise<void> {
    const c = Math.max(20, Math.min(500, Math.floor(cols)))
    const r = Math.max(6, Math.min(300, Math.floor(rows)))
    await this.command(`refresh-client -C ${c}x${r}`)
  }

  async resizePane(paneId: string, opts: { width?: number; height?: number }): Promise<void> {
    if (opts.width !== undefined) {
      await this.command(`resize-pane -t ${quote(paneId)} -x ${Math.max(4, Math.floor(opts.width))}`)
    }
    if (opts.height !== undefined) {
      await this.command(`resize-pane -t ${quote(paneId)} -y ${Math.max(3, Math.floor(opts.height))}`)
    }
    this.scheduleRefresh()
  }

  async refreshSnapshot(): Promise<TmuxSnapshot> {
    const win = await this.command(
      "display-message -p -F '#{window_id}\t#{window_name}\t#{window_width}\t#{window_height}\t#{window_layout}\t#{session_name}'",
    )
    const [windowId, windowName, w, h, layout, sessionName] = win.trim().split('\t')
    if (sessionName) this.sessionName = sessionName
    const list = await this.command(
      "list-panes -F '#{pane_id}\t#{pane_index}\t#{pane_title}\t#{pane_left}\t#{pane_top}\t#{pane_width}\t#{pane_height}\t#{pane_active}\t#{@dsh_role}'",
    )
    const windowsRaw = await this.command(
      "list-windows -F '#{window_id}\t#{window_index}\t#{window_name}\t#{window_active}'",
    )
    const sessions = await this.listSessions(this.tmuxBin)
    const viewers = await this.countViewers().catch(() => 0)
    const fromList = list.trim() === '' ? [] : list.trim().split('\n').map(parsePaneLine)
    const panes = mergePanes(fromList, safeParse(layout ?? ''))
    const windows: WindowInfo[] = windowsRaw.trim() === '' ? [] : windowsRaw.trim().split('\n').map((line) => {
      const [id, index, name, active] = line.split('\t')
      return { id: id ?? '', index: Number(index) || 0, name: name ?? '', active: active === '1' }
    })
    const snap: TmuxSnapshot = {
      session: this.sessionName,
      windowId: windowId ?? '',
      windowName: windowName ?? '',
      cols: Number(w) || 80,
      rows: Number(h) || 24,
      panes,
      sessions,
      windows,
      viewers,
    }
    this.snapshot = snap
    this.emit('snapshot', snap)
    return snap
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      if (!this.attached) return
      void this.refreshSnapshot().catch((err: unknown) => {
        this.emit('error', err instanceof Error ? err.message : String(err))
      })
    }, 80)
  }

  private command(line: string): Promise<string> {
    const transport = this.transport
    if (transport === null) return Promise.reject(new Error('not attached'))
    return new Promise((resolve, reject) => {
      const pending: Pending = {
        line,
        settled: false,
        resolve,
        reject,
        // A timed-out command fails alone; its queue slot stays so the
        // FIFO reply pairing keeps its alignment if the reply is just late.
        timer: setTimeout(() => {
          pending.settled = true
          reject(new Error(`tmux command timed out: ${line.split(' ')[0]}`))
        }, this.commandTimeoutMs),
      }
      this.queue.push(pending)
      transport.write(`${line}\n`)
    })
  }

  private settle(pending: Pending, err: Error | null, text: string): void {
    clearTimeout(pending.timer)
    if (pending.settled) return
    pending.settled = true
    if (err) pending.reject(err)
    else pending.resolve(text)
  }

  private failAll(err: Error): void {
    for (const item of this.queue) this.settle(item, err, '')
    this.queue = []
  }

  private push(chunk: string): void {
    this.buf += chunk
    while (true) {
      const nl = this.buf.indexOf('\n')
      if (nl < 0) return
      const line = this.buf.slice(0, nl).replace(/\r$/, '')
      this.buf = this.buf.slice(nl + 1)
      this.handleLine(line)
    }
  }

  private handleLine(line: string): void {
    if (this.block !== null) {
      const closing = parseBlockEdge(line)
      // Close only on the %end/%error carrying this block's number — block
      // content lines can legitimately start with anything (nested tmux…).
      if (closing !== null && (closing.kind === 'end' || closing.kind === 'error') && closing.num === this.block.num) {
        const text = this.block.lines.join('\n')
        this.block = null
        this.closeBlock(closing.kind === 'error', closing.ours, text)
        return
      }
      this.block.lines.push(line)
      return
    }
    const edge = parseBlockEdge(line)
    if (edge !== null && edge.kind === 'begin') {
      this.block = { num: edge.num, lines: [] }
      return
    }
    if (line.startsWith('%output ')) {
      const rest = line.slice('%output '.length)
      const sp = rest.indexOf(' ')
      if (sp < 0) return
      this.emit('output', rest.slice(0, sp), decodeControlOutput(rest.slice(sp + 1)))
      return
    }
    if (
      line.startsWith('%layout-change ')
      || line.startsWith('%window-pane-changed ')
      || line.startsWith('%session-window-changed ')
      || line.startsWith('%window-renamed ')
      || line.startsWith('%session-changed ')
      || line.startsWith('%session-renamed ')
      || line.startsWith('%window-add ')
      || line.startsWith('%window-close ')
      || line.startsWith('%unlinked-window-add ')
      || line.startsWith('%unlinked-window-close ')
    ) {
      this.scheduleRefresh()
      return
    }
    if (line.startsWith('%exit')) {
      const reason = line.slice('%exit'.length).trim()
      if (reason && !this.requestedDetach) this.emit('error', reason)
    }
  }

  private closeBlock(isError: boolean, ours: boolean, text: string): void {
    if (!ours) {
      // Unsolicited block (e.g. the attach guard). Surface real errors.
      if (isError && text.trim() !== '') this.emit('error', text.trim())
      return
    }
    const pending = this.queue.shift()
    if (pending === undefined) {
      if (isError && text.trim() !== '') this.emit('error', text.trim())
      return
    }
    if (isError) this.settle(pending, new Error(text.trim() || 'tmux error'), '')
    else this.settle(pending, null, text)
  }
}

/** `%begin/%end/%error <ts> <num> <flags>` — flags bit 0 marks our own command's block. */
function parseBlockEdge(line: string): { kind: 'begin' | 'end' | 'error'; num: string; ours: boolean } | null {
  const match = /^%(begin|end|error) (\d+) (\d+) (\d+)$/.exec(line)
  if (match === null) return null
  return {
    kind: match[1] as 'begin' | 'end' | 'error',
    num: match[3],
    ours: (Number(match[4]) & 1) === 1,
  }
}

export async function listSessionsCli(tmuxBin: string): Promise<SessionInfo[]> {
  try {
    const { stdout } = await execFileAsync(tmuxBin, [
      'list-sessions',
      '-F',
      '#{session_name}\t#{session_attached}\t#{session_windows}',
    ], { timeout: 2000 })
    return stdout.trim() === '' ? [] : stdout.trim().split('\n').map((line) => {
      const [name, attached, windows] = line.split('\t')
      return { name: name ?? '', attached: Number(attached) || 0, windows: Number(windows) || 0 }
    })
  } catch {
    return []
  }
}

function parsePaneLine(line: string): TmuxPane {
  const [id, index, title, left, top, width, height, active, role] = line.split('\t')
  return {
    id: id ?? '',
    index: Number(index) || 0,
    title: title ?? '',
    role: role ?? '',
    left: Number(left) || 0,
    top: Number(top) || 0,
    width: Number(width) || 0,
    height: Number(height) || 0,
    active: active === '1',
  }
}

function safeParse(layout: string): PaneRect[] {
  if (!layout) return []
  try {
    return parseLayout(layout).panes
  } catch {
    return []
  }
}

function mergePanes(listed: TmuxPane[], layout: PaneRect[]): TmuxPane[] {
  if (listed.length === 0 || layout.length === 0) return listed
  return listed.map((pane) => {
    const numeric = pane.id.replace(/^%/, '')
    const hit = layout.find((rect) => rect.id === numeric)
      ?? layout.find((rect) => Math.abs(rect.left - pane.left) < 1 && Math.abs(rect.top - pane.top) < 1)
    return hit === undefined ? pane : { ...pane, left: hit.left, top: hit.top, width: hit.width, height: hit.height }
  })
}

function quote(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error('invalid tmux target')
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function defaultTransport(tmuxBin: string, args: string[]): ControlTransport {
  const child = spawn(tmuxBin, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // %output octal-escapes multibyte characters on a non-UTF-8 client;
      // force a UTF-8 locale so text passes through verbatim.
      LANG: process.env.LANG?.toLowerCase().includes('utf') ? process.env.LANG : 'C.UTF-8',
    },
  })
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  return {
    write: (data) => { child.stdin.write(data) },
    kill: () => { child.kill() },
    onData: (fn) => { child.stdout.on('data', fn) },
    onStderr: (fn) => { child.stderr.on('data', fn) },
    onExit: (fn) => { child.on('exit', (code) => fn(code)) },
  }
}
