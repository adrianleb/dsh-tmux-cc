import assert from 'node:assert/strict'
import test from 'node:test'
import { TmuxRuntime, type SocketLike } from './runtime.ts'
import type { TmuxSnapshot } from './tmux-client.ts'

class FakeSocket implements SocketLike {
  sent: string[] = []
  private handlers = new Map<string, (...args: never[]) => void>()
  send(data: string): void { this.sent.push(data) }
  close(): void { /* unused */ }
  on(event: 'message' | 'close', fn: ((data: string) => void) | (() => void)): void {
    this.handlers.set(event, fn as (...args: never[]) => void)
  }
}

class FakeTmuxClient {
  attached = true
  calls: string[] = []
  takeoverGate: Promise<void> | null = null
  captureGate: Promise<void> | null = null
  liveViewers: number | null = null
  viewerCheckFails = false
  ignoreFailures = 0
  captureCalls: Array<{ lines: unknown; pane: string | undefined }> = []
  snap: TmuxSnapshot = {
    session: 'verify',
    windowId: '@1',
    windowName: 'main',
    cols: 120,
    rows: 40,
    zoomed: false,
    panes: [],
    sessions: [],
    windows: [],
    viewers: 0,
  }
  get session(): string { return this.attached ? this.snap.session : '' }
  currentSnapshot(): TmuxSnapshot { return this.snap }
  async attach(session: string): Promise<void> {
    this.calls.push(`attach:${session}`)
    this.attached = true
    this.snap = { ...this.snap, session }
  }
  detach(): void {
    this.calls.push('detach')
    this.attached = false
  }
  async countViewers(): Promise<number> {
    if (this.viewerCheckFails) throw new Error('viewer check failed')
    return this.liveViewers ?? this.snap.viewers
  }
  async takeOverSize(cols: number, rows: number): Promise<void> {
    this.calls.push(`takeover:${cols}x${rows}`)
    if (this.takeoverGate !== null) await this.takeoverGate
  }
  async setClientSize(cols: number, rows: number): Promise<void> { this.calls.push(`size:${cols}x${rows}`) }
  async setIgnoreSize(on: boolean): Promise<void> {
    this.calls.push(`ignore:${on}`)
    if (this.ignoreFailures > 0) {
      this.ignoreFailures -= 1
      throw new Error('ignore-size failed')
    }
  }
  async captureVisible(lines?: unknown, pane?: string): Promise<Array<{ pane: string; data: string }>> {
    this.captureCalls.push({ lines, pane })
    if (this.captureGate !== null) await this.captureGate
    return [{ pane: pane ?? '%1', data: `history:${String(lines)}` }]
  }
  async newWindow(): Promise<void> { this.calls.push('new-window') }
  async split(dir: string, pane?: string): Promise<void> { this.calls.push(`split:${dir}:${String(pane)}`) }
  async resizePaneDirection(pane: string, dir: string, amount?: number): Promise<void> {
    this.calls.push(`resize-dir:${pane}:${dir}:${String(amount)}`)
  }
}

test('a browser retracting its grid returns the tmux client to mirror mode', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(socket, JSON.stringify({ type: 'resize', cols: 100, rows: 30 }))
  assert.deepEqual(fakeClient.calls, ['takeover:100x30'])
  assert.equal(internals.sizeMode, 'takeover')

  await internals.handle(socket, JSON.stringify({ type: 'resize', active: false }))
  assert.deepEqual(fakeClient.calls, ['takeover:100x30', 'ignore:true'])
  assert.equal(internals.sizeMode, 'mirror')
})

test('bursty grid reports coalesce to the newest trailing size', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  let release!: () => void
  fakeClient.takeoverGate = new Promise<void>(resolve => { release = resolve })
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient

  const first = internals.handle(socket, JSON.stringify({ type: 'resize', cols: 100, rows: 30 }))
  const second = internals.handle(socket, JSON.stringify({ type: 'resize', cols: 90, rows: 28 }))
  const third = internals.handle(socket, JSON.stringify({ type: 'resize', cols: 70, rows: 20 }))
  release()
  await Promise.all([first, second, third])

  assert.deepEqual(fakeClient.calls, ['takeover:100x30', 'size:70x20'])
})

test('another real tmux seat prevents a reported browser grid from taking over', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  fakeClient.snap = { ...fakeClient.snap, viewers: 1 }
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(new FakeSocket(), JSON.stringify({ type: 'resize', cols: 80, rows: 24 }))
  assert.deepEqual(fakeClient.calls, [])
  assert.equal(internals.sizeMode, 'mirror')
})

test('a fresh viewer check prevents takeover from a stale zero snapshot', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  fakeClient.liveViewers = 1
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(new FakeSocket(), JSON.stringify({ type: 'resize', cols: 80, rows: 24 }))
  assert.deepEqual(fakeClient.calls, [])
  assert.equal(internals.sizeMode, 'mirror')
})

test('a failed fresh viewer check fails closed', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  fakeClient.viewerCheckFails = true
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(new FakeSocket(), JSON.stringify({ type: 'resize', cols: 80, rows: 24 }))
  assert.deepEqual(fakeClient.calls, [])
  assert.equal(internals.sizeMode, 'mirror')
})

test('mirror-only policy never lets browser grid votes resize tmux', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux', sizePolicy: 'mirror' })
  const fakeClient = new FakeTmuxClient()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(new FakeSocket(), JSON.stringify({ type: 'resize', cols: 100, rows: 30 }))
  assert.deepEqual(fakeClient.calls, [])
  assert.equal(internals.sizeMode, 'mirror')
  assert.equal(runtime.getSettings().sizePolicy, 'mirror')
})

test('a live settings source can return an active takeover to mirror mode', async () => {
  let policy: 'auto' | 'mirror' = 'auto'
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux', getSizePolicy: () => policy })
  const fakeClient = new FakeTmuxClient()
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    queueSizePolicy(): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(socket, JSON.stringify({ type: 'resize', cols: 100, rows: 30 }))
  assert.equal(internals.sizeMode, 'takeover')
  policy = 'mirror'
  await internals.queueSizePolicy()
  assert.deepEqual(fakeClient.calls, ['takeover:100x30', 'ignore:true'])
  assert.equal(internals.sizeMode, 'mirror')
})

test('session switches reapply surviving browser size votes to the fresh control client', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    ensureSession(session: string): Promise<void>
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient
  internals.ensureSession = async () => {}

  await internals.handle(socket, JSON.stringify({ type: 'resize', cols: 100, rows: 30 }))
  await runtime.attach('other')
  assert.deepEqual(fakeClient.calls, [
    'takeover:100x30',
    'detach',
    'attach:other',
    'takeover:100x30',
  ])
  runtime.dispose()
})

test('failed size-policy writes retry until mirror mode is enforced', async () => {
  let policy: 'auto' | 'mirror' = 'auto'
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux', getSizePolicy: () => policy })
  const fakeClient = new FakeTmuxClient()
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
    queueSizePolicy(): Promise<void>
    sizeMode: 'mirror' | 'takeover'
  }
  internals.client = fakeClient

  await internals.handle(socket, JSON.stringify({ type: 'resize', cols: 100, rows: 30 }))
  policy = 'mirror'
  fakeClient.ignoreFailures = 1
  await assert.rejects(internals.queueSizePolicy(), /ignore-size failed/)
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.deepEqual(fakeClient.calls, ['takeover:100x30', 'ignore:true', 'ignore:true'])
  assert.equal(internals.sizeMode, 'mirror')
  runtime.dispose()
})

test('capture work is globally serialized and coalesced per browser', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  let release!: () => void
  fakeClient.captureGate = new Promise<void>(resolve => { release = resolve })
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    sockets: Set<SocketLike>
    captureTask: Promise<void> | null
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient
  internals.sockets.add(socket)

  await Promise.all([
    internals.handle(socket, JSON.stringify({ type: 'capture', pane: '%5', lines: 100 })),
    internals.handle(socket, JSON.stringify({ type: 'capture', pane: '%5', lines: 200 })),
    internals.handle(socket, JSON.stringify({ type: 'capture', pane: '%5', lines: 300 })),
  ])
  const captureTask = internals.captureTask
  release()
  await captureTask
  assert.deepEqual(fakeClient.captureCalls, [
    { lines: 100, pane: '%5' },
    { lines: 300, pane: '%5' },
  ])
})

test('multi-pane history is sent pane-by-pane instead of held to the end', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  fakeClient.snap = {
    ...fakeClient.snap,
    panes: [
      { id: '%1', index: 1, title: '', role: '', left: 0, top: 0, width: 40, height: 20, active: true },
      { id: '%2', index: 2, title: '', role: '', left: 40, top: 0, width: 40, height: 20, active: false },
    ],
  }
  let releaseSecond!: () => void
  const secondGate = new Promise<void>(resolve => { releaseSecond = resolve })
  fakeClient.captureVisible = async (lines?: unknown, pane?: string) => {
    fakeClient.captureCalls.push({ lines, pane })
    if (pane === '%2') await secondGate
    return [{ pane: pane ?? '', data: `history:${pane}` }]
  }
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    sockets: Set<SocketLike>
    captureTask: Promise<void> | null
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient
  internals.sockets.add(socket)

  await internals.handle(socket, JSON.stringify({ type: 'capture', lines: 100 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(socket.sent.map(raw => JSON.parse(raw)), [
    { type: 'history', pane: '%1', data: 'history:%1' },
  ])
  const captureTask = internals.captureTask
  releaseSecond()
  await captureTask
  assert.deepEqual(socket.sent.map(raw => JSON.parse(raw)), [
    { type: 'history', pane: '%1', data: 'history:%1' },
    { type: 'history', pane: '%2', data: 'history:%2' },
  ])
})

test('a pane capture failure is reported while later pane captures continue', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  fakeClient.snap = {
    ...fakeClient.snap,
    panes: [
      { id: '%1', index: 1, title: '', role: '', left: 0, top: 0, width: 40, height: 20, active: true },
      { id: '%2', index: 2, title: '', role: '', left: 40, top: 0, width: 40, height: 20, active: false },
    ],
  }
  fakeClient.captureVisible = async (_lines?: unknown, pane?: string) => {
    if (pane === '%1') throw new Error('capture timeout')
    return [{ pane: pane ?? '', data: 'second history' }]
  }
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    sockets: Set<SocketLike>
    captureTask: Promise<void> | null
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient
  internals.sockets.add(socket)

  await internals.handle(socket, JSON.stringify({ type: 'capture', lines: 100 }))
  await internals.captureTask
  assert.deepEqual(socket.sent.map(raw => JSON.parse(raw)), [
    { type: 'error', message: 'history capture failed for %1: capture timeout' },
    { type: 'history', pane: '%2', data: 'second history' },
  ])
})

test('shortcut protocol dispatches new-window and directional pane resize', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  const socket = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient

  await internals.handle(socket, JSON.stringify({ type: 'new-window' }))
  await internals.handle(socket, JSON.stringify({ type: 'split', dir: 'h', pane: '%5' }))
  await internals.handle(socket, JSON.stringify({ type: 'resize-pane-dir', pane: '%5', dir: 'U', amount: 1 }))
  assert.deepEqual(fakeClient.calls, ['new-window', 'split:h:%5', 'resize-dir:%5:U:1'])

  await assert.rejects(internals.handle(socket, JSON.stringify({ type: 'split', dir: 'h' })), /invalid split request/)
  await assert.rejects(internals.handle(socket, JSON.stringify({ type: 'split', dir: 'bogus', pane: '%5' })), /invalid split request/)
  await assert.rejects(
    internals.handle(socket, JSON.stringify({ type: 'resize-pane-dir', pane: '%5', dir: 'bogus' })),
    /invalid directional pane resize request/,
  )
  assert.deepEqual(fakeClient.calls, ['new-window', 'split:h:%5', 'resize-dir:%5:U:1'])
})

test('history capture replies only to the requesting browser', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: 'tmux' })
  const fakeClient = new FakeTmuxClient()
  const first = new FakeSocket()
  const second = new FakeSocket()
  const internals = runtime as unknown as {
    client: FakeTmuxClient
    sockets: Set<SocketLike>
    captureTask: Promise<void> | null
    handle(socket: SocketLike, raw: string): Promise<void>
  }
  internals.client = fakeClient
  internals.sockets.add(first)
  internals.sockets.add(second)

  await internals.handle(first, JSON.stringify({ type: 'capture', pane: '%5', lines: 321 }))
  await internals.captureTask
  assert.deepEqual(fakeClient.captureCalls, [{ lines: 321, pane: '%5' }])
  assert.equal(first.sent.length, 1)
  assert.deepEqual(JSON.parse(first.sent[0]), { type: 'history', pane: '%5', data: 'history:321' })
  assert.deepEqual(second.sent, [])
})
