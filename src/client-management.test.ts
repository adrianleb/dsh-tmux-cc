import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const storeSource = source.match(/function createStore\(\) \{[\s\S]*?\n    \}/)?.[0]
assert.ok(storeSource)

function fixture() {
  const timers = new Map<number, { fn: () => void; delay: number }>()
  let sequence = 0
  const sent: Array<Record<string, unknown>> = []
  const sockets: Socket[] = []
  class Socket {
    readyState = 1
    onopen: (() => void) | null = null
    onmessage: ((ev: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    constructor() { sockets.push(this) }
    send(data: string) { sent.push(JSON.parse(data)) }
    close() { this.readyState = 3; this.onclose?.() }
    reply(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }) }
  }
  const win = {
    setTimeout(fn: () => void, delay: number) { const id = ++sequence; timers.set(id, { fn, delay }); return id },
    clearTimeout(id: number) { timers.delete(id) },
  }
  const create = Function('window', 'WebSocket', 'location', 'loadPrefs', 't', `return (${storeSource})`)(
    win, Socket, { protocol: 'http:', host: 'fixture.test' },
    () => ({ open: false, session: '', scrollbackLines: 2000 }), (key: string) => key,
  )
  const store = create() as {
    connect(): void
    dispose(): void
    get(): { connected: boolean; snapshot: { sessions: unknown[] } | null; error: string }
    managementRequest(type: string, fields?: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  store.connect()
  return { store, sent, sockets, timers }
}

function inventory(requestId: unknown, sessions: unknown[] = []) {
  return { type: 'management', requestId, clients: [], sessions }
}

test('management requests are correlated and ignore duplicate or unrelated replies', async () => {
  const { store, sent, sockets, timers } = fixture()
  try {
    const a = store.managementRequest('management')
    const b = store.managementRequest('create-session', { name: 'test', cwd: '/tmp' })
    const [first, second] = sent
    assert.notEqual(first.requestId, second.requestId)
    assert.equal(second.name, 'test')
    assert.equal(second.cwd, '/tmp')
    sockets[0].reply({ type: 'error', requestId: 'unrelated', message: 'not for this request' })
    assert.equal(store.get().error, '')
    sockets[0].reply(inventory(second.requestId))
    assert.equal((await b).requestId, second.requestId)
    assert.equal(timers.size, 1)
    sockets[0].reply(inventory(second.requestId))
    assert.equal(timers.size, 1, 'a duplicate must not settle another request')
    sockets[0].reply({ type: 'error', requestId: first.requestId, message: 'inventory unavailable' })
    await assert.rejects(a, /inventory unavailable/)
    assert.equal(store.get().error, '', 'form errors must not overwrite the terminal strip')
    assert.equal(timers.size, 0)
  } finally { store.dispose() }
})

test('timed out management replies cannot overwrite newer session inventory', async () => {
  const { store, sent, sockets, timers } = fixture()
  try {
    sockets[0].reply({ type: 'snapshot', snapshot: { attached: false, sessions: [{ name: 'original' }] } })
    const old = store.managementRequest('management')
    const rejection = assert.rejects(old, /requestTimeout/)
    const timeout = [...timers.entries()].find(([, timer]) => timer.delay === 30000)!
    timers.delete(timeout[0]); timeout[1].fn()
    await rejection
    const fresh = store.managementRequest('management')
    sockets[0].reply(inventory(sent[1].requestId, [{ name: 'new' }]))
    await fresh
    sockets[0].reply(inventory(sent[0].requestId, [{ name: 'stale' }]))
    assert.deepEqual(store.get().snapshot?.sessions, [{ name: 'new' }])
  } finally { store.dispose() }
})

test('disconnect rejects pending mutations and reconnect never replays them', async () => {
  const { store, sent, sockets } = fixture()
  try {
    const mutation = store.managementRequest('detach-clients', { clients: [{ name: '/dev/pts/1', pid: 123, created: 456 }] })
    const rejected = assert.rejects(mutation, /requestInterrupted/)
    sockets[0].close()
    await rejected
    assert.equal(store.get().connected, false)
    await assert.rejects(store.managementRequest('management'), /disconnected/)
    store.connect()
    sockets[1].onopen?.()
    assert.equal(sent.filter(msg => msg.type === 'detach-clients').length, 1)
    assert.equal(store.get().connected, true)
  } finally { store.dispose() }
})

test('unload rejects pending requests and clears their timers', async () => {
  const { store, timers } = fixture()
  const pending = store.managementRequest('create-session', { name: 'new' })
  const rejected = assert.rejects(pending, /requestInterrupted/)
  store.dispose()
  await rejected
  assert.equal(timers.size, 0)
  await assert.rejects(store.managementRequest('management'), /disconnected/)
})
