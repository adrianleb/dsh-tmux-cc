import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { TmuxControlClient, listSessionsCli, type TmuxSnapshot } from './tmux-client.ts'
import {
  DEFAULT_PREFS,
  type ClientToHost,
  type DockPrefs,
  type HostToClient,
  type LayoutInfo,
  type LayoutSpec,
  type Snapshot,
} from './types.ts'

const execFileAsync = promisify(execFile)

export interface RuntimeConfig {
  tmuxBin: string
  layouts?: LayoutSpec[]
}

export interface SocketLike {
  send(data: string): void
  close(code?: number, reason?: string): void
  on(event: 'message', fn: (data: string) => void): void
  on(event: 'close', fn: () => void): void
}

export class TmuxRuntime {
  private readonly tmuxBin: string
  private readonly layouts: LayoutSpec[]
  private client: TmuxControlClient | null = null
  private prefs: DockPrefs = { ...DEFAULT_PREFS }
  private sockets = new Set<SocketLike>()
  /** Dock grid the browser last asked for (used only in takeover mode). */
  private desiredSize: { cols: number; rows: number } | null = null
  private sizeMode: 'mirror' | 'takeover' = 'mirror'
  private appliedSize = ''
  private viewerPoll: ReturnType<typeof setInterval> | null = null

  constructor(config: RuntimeConfig) {
    this.tmuxBin = config.tmuxBin
    this.layouts = config.layouts ?? []
  }

  getPrefs(): DockPrefs {
    return this.prefs
  }

  /**
   * Sanity-clamp and store prefs, then fan out to every *other* client.
   * The sender already applied the change locally; echoing it back causes
   * feedback loops during drag-resize.
   */
  setPrefs(patch: Partial<DockPrefs>, sender?: SocketLike): DockPrefs {
    const next = { ...this.prefs, ...patch }
    next.side = next.side === 'right' ? 'right' : 'bottom'
    const size = Number(next.size)
    if (!Number.isFinite(size)) next.size = next.side === 'right' ? 360 : 280
    else next.size = Math.max(120, Math.min(3000, Math.round(size)))
    next.open = next.open === true
    next.pinned = next.pinned !== false
    next.session = typeof next.session === 'string' ? next.session : ''
    this.prefs = next
    this.broadcast({ type: 'prefs', prefs: this.prefs }, sender)
    return this.prefs
  }

  async snapshot(): Promise<Snapshot> {
    if (this.client?.attached) {
      const snap = this.client.currentSnapshot()
      if (snap) return this.toSnapshot(snap, true)
    }
    const sessions = await listSessionsCli(this.tmuxBin)
    return {
      session: this.prefs.session,
      windowId: '',
      windowName: '',
      cols: 80,
      rows: 24,
      zoomed: false,
      attached: false,
      panes: [],
      sessions,
      windows: [],
      layouts: this.layoutInfos(),
      viewers: 0,
      sizeMode: 'mirror',
    }
  }

  async attach(session: string): Promise<Snapshot> {
    const resolved = this.resolveSession(session)
    if (!this.client) this.client = this.makeClient()
    if (this.client.attached && this.client.session !== resolved) this.client.detach()
    if (!this.client.attached) {
      await this.ensureSession(resolved)
      await this.client.attach(resolved)
      this.startViewerPoll()
    }
    this.setPrefs({ session: resolved })
    return this.snapshot()
  }

  detach(): void {
    this.resetSizeState()
    this.client?.detach()
    void this.snapshot().then((snap) => this.broadcast({ type: 'snapshot', snapshot: snap }))
  }

  dispose(): void {
    this.resetSizeState()
    this.client?.detach()
    this.client = null
    for (const socket of this.sockets) socket.close(1001, 'plugin unload')
    this.sockets.clear()
  }

  /**
   * Size policy. Someone else at the table (a real seat or an iTerm -CC
   * client) → mirror: we ignore-size and scale our rendering. Alone → the
   * dock dictates the window geometry at its native font size.
   */
  private async applySizePolicy(snap: TmuxSnapshot): Promise<void> {
    const client = this.client
    if (client === null || !client.attached) return
    if (snap.viewers > 0) {
      if (this.sizeMode !== 'mirror') {
        this.sizeMode = 'mirror'
        this.appliedSize = ''
        await client.setIgnoreSize(true)
      }
      return
    }
    if (this.desiredSize === null) return
    if (this.sizeMode !== 'takeover') {
      this.sizeMode = 'takeover'
      await client.setIgnoreSize(false)
    }
    const key = `${this.desiredSize.cols}x${this.desiredSize.rows}`
    if (this.appliedSize !== key) {
      this.appliedSize = key
      await client.setClientSize(this.desiredSize.cols, this.desiredSize.rows)
    }
  }

  private resetSizeState(): void {
    this.sizeMode = 'mirror'
    this.appliedSize = ''
    if (this.viewerPoll) clearInterval(this.viewerPoll)
    this.viewerPoll = null
  }

  /** Watch for seats appearing/disappearing; tmux has no notification for it. */
  private startViewerPoll(): void {
    if (this.viewerPoll) clearInterval(this.viewerPoll)
    this.viewerPoll = setInterval(() => {
      const client = this.client
      if (client === null || !client.attached) return
      void client.countViewers()
        .then(async (viewers) => {
          if (viewers !== (client.currentSnapshot()?.viewers ?? 0)) {
            await client.refreshSnapshot()
          }
        })
        .catch(() => { /* transient */ })
    }, 5000)
  }

  bind(socket: SocketLike): void {
    this.sockets.add(socket)
    socket.send(JSON.stringify({ type: 'prefs', prefs: this.prefs } satisfies HostToClient))
    void this.snapshot().then((snap) => {
      socket.send(JSON.stringify({ type: 'snapshot', snapshot: snap } satisfies HostToClient))
    })
    socket.on('message', (raw) => {
      void this.handle(socket, raw).catch((err: unknown) => {
        socket.send(JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        } satisfies HostToClient))
      })
    })
    socket.on('close', () => {
      this.sockets.delete(socket)
    })
  }

  /** A layout id is accepted anywhere a session name is; it maps to its session. */
  private resolveSession(nameOrLayoutId: string): string {
    const layout = this.layouts.find((l) => l.id === nameOrLayoutId || l.session === nameOrLayoutId)
    return layout?.session ?? nameOrLayoutId
  }

  /** Run the configured launcher when the target session does not exist yet. */
  private async ensureSession(session: string): Promise<void> {
    const sessions = await listSessionsCli(this.tmuxBin)
    if (sessions.some((s) => s.name === session)) return
    const layout = this.layouts.find((l) => l.session === session)
    if (layout?.launch === undefined) {
      throw new Error(`tmux session "${session}" not found`)
    }
    try {
      await execFileAsync(layout.launch, layout.launchArgs ?? ['--ensure-only'], { timeout: 20000 })
    } catch (err) {
      throw new Error(`launcher for "${session}" failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    const after = await listSessionsCli(this.tmuxBin)
    if (!after.some((s) => s.name === session)) {
      throw new Error(`launcher ran but tmux session "${session}" still does not exist`)
    }
  }

  private layoutInfos(): LayoutInfo[] {
    return this.layouts.map(({ id, label, session }) => ({ id, label, session }))
  }

  private makeClient(): TmuxControlClient {
    const client = new TmuxControlClient(this.tmuxBin)
    client.on('snapshot', (snap) => {
      // Settle the size policy first so the broadcast reports the final mode.
      void this.applySizePolicy(snap)
        .catch(() => { /* transient */ })
        .finally(() => {
          this.broadcast({ type: 'snapshot', snapshot: this.toSnapshot(snap, true) })
        })
    })
    client.on('output', (pane, data) => {
      this.broadcast({ type: 'output', pane, data })
    })
    client.on('history', (pane, data) => {
      this.broadcast({ type: 'history', pane, data })
    })
    client.on('error', (message) => {
      this.broadcast({ type: 'error', message })
    })
    client.on('exit', () => {
      // Only unexpected exits arrive here; a requested detach broadcasts from detach().
      this.resetSizeState()
      void this.snapshot().then((snap) => this.broadcast({
        type: 'snapshot',
        snapshot: { ...snap, attached: false, error: 'tmux control client exited' },
      }))
    })
    return client
  }

  private async handle(socket: SocketLike, raw: string): Promise<void> {
    let msg: ClientToHost
    try {
      msg = JSON.parse(raw) as ClientToHost
    } catch {
      throw new Error('invalid message')
    }
    if (msg.type === 'hello' || msg.type === 'refresh') {
      socket.send(JSON.stringify({ type: 'snapshot', snapshot: await this.snapshot() } satisfies HostToClient))
      return
    }
    if (msg.type === 'capture') {
      if (this.client?.attached) await this.client.captureVisible()
      return
    }
    if (msg.type === 'prefs') {
      this.setPrefs(msg.prefs, socket)
      return
    }
    if (msg.type === 'attach') {
      const snap = await this.attach(msg.session)
      socket.send(JSON.stringify({ type: 'snapshot', snapshot: snap } satisfies HostToClient))
      return
    }
    if (msg.type === 'detach') {
      this.detach()
      return
    }
    if (msg.type === 'resize') {
      const cols = Number(msg.cols)
      const rows = Number(msg.rows)
      if (Number.isFinite(cols) && Number.isFinite(rows)) {
        this.desiredSize = { cols: Math.floor(cols), rows: Math.floor(rows) }
        const snap = this.client?.currentSnapshot()
        if (snap && this.client?.attached) await this.applySizePolicy(snap)
      }
      return
    }
    const client = this.client
    if (client === null || !client.attached) throw new Error('not attached')
    if (msg.type === 'input') { await client.sendKeys(msg.pane, msg.data); return }
    if (msg.type === 'select') { await client.selectPane(msg.pane); return }
    if (msg.type === 'select-window') { await client.selectWindow(msg.windowId); return }
    if (msg.type === 'zoom') { await client.zoom(msg.pane); return }
    if (msg.type === 'split') { await client.split(msg.dir); return }
    if (msg.type === 'kill') { await client.killPane(msg.pane); return }
    if (msg.type === 'resize-pane') {
      await client.resizePane(msg.pane, { width: msg.width, height: msg.height })
      return
    }
    if (msg.type === 'select-dir') { await client.selectDir(msg.dir) }
  }

  private broadcast(msg: HostToClient, skip?: SocketLike): void {
    const raw = JSON.stringify(msg)
    for (const socket of this.sockets) {
      if (socket === skip) continue
      try { socket.send(raw) } catch { /* closed */ }
    }
  }

  private toSnapshot(snap: TmuxSnapshot, attached: boolean): Snapshot {
    return {
      session: snap.session,
      windowId: snap.windowId,
      windowName: snap.windowName,
      cols: snap.cols,
      rows: snap.rows,
      zoomed: snap.zoomed,
      attached,
      panes: snap.panes,
      sessions: snap.sessions,
      windows: snap.windows,
      layouts: this.layoutInfos(),
      viewers: snap.viewers,
      sizeMode: this.sizeMode,
    }
  }
}
