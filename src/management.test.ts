import assert from 'node:assert/strict'
import test from 'node:test'
import { listSessionsCli, isNoTmuxServer, type TmuxRunner } from './tmux-cli.ts'
import { listAttachedClientsCli, TmuxManagement, validateManagementRequest } from './tmux-management.ts'
import { TmuxRuntime, type SocketLike } from './runtime.ts'
import type { AttachedClientInfo, HostToClient, Snapshot } from './types.ts'

const client: AttachedClientInfo = {
  name: '/dev/pts/3', pid: 300, created: 1700000000, session: 'main', tty: '/dev/pts/3', term: 'xterm-256color',
  cols: 120, rows: 40, flags: ['attached', 'focused'], control: false, own: false,
}
const clientLine = (value: AttachedClientInfo) => [
  value.name, value.pid, value.created, value.session, value.tty, value.term, value.cols, value.rows,
  value.flags.join(','), Number(value.control),
].join('\t') + '\n'

test('management validates malformed wire requests before any native commands', () => {
  const malformed: unknown[] = [null, [], true, { type: 'other', requestId: 'id' },
    { type: 'management' }, { type: 'management', requestId: 9 }, { type: 'management', requestId: '' },
    { type: 'management', requestId: 'x'.repeat(201) }, { type: 'management', requestId: 'x\ny' },
  ]
  for (const name of [undefined, null, 1, '', ' ', 'x'.repeat(201), 'a.b', 'a:b', 'foo;', ';kill-server', 'x\ny', 'x\ty', 'x\0y', 'x\x7fy', 'x\x85y']) {
    malformed.push({ type: 'create-session', requestId: 'id', name })
    malformed.push({ type: 'rename-session', requestId: 'id', session: 'good', newName: name })
    malformed.push({ type: 'rename-session', requestId: 'id', session: name, newName: 'good' })
  }
  for (const cwd of ['', '.', 'relative/path', 4, null, ['/tmp'], '/tmp;kill-server', '/tmp\n']) {
    malformed.push({ type: 'create-session', requestId: 'id', name: 'good', cwd })
  }
  for (const clients of [undefined, null, {}, [], [null], ['name'], [{ name: client.name }],
    [{ ...client, pid: '300' }], [{ ...client, pid: 0 }], [{ ...client, pid: 1.1 }],
    [{ ...client, pid: Number.MAX_SAFE_INTEGER + 1 }], [{ ...client, created: -1 }], [{ ...client, created: 1.1 }],
    [{ ...client, name: '' }], [{ ...client, name: 'x;kill-server' }], [{ ...client, name: 'x\ny' }],
    [client, client], Array.from({ length: 101 }, (_, i) => ({ ...client, name: `client-${i}` })),
  ]) malformed.push({ type: 'detach-clients', requestId: 'id', clients })
  for (const request of malformed) assert.throws(() => validateManagementRequest(request), Error, JSON.stringify(request))
  for (const name of ['main', '-dash', 'with space', '日本語', '*glob', "'quote", 'x'.repeat(200)]) {
    assert.equal(validateManagementRequest({ type: 'create-session', requestId: 'id', name }).type, 'create-session')
  }
})

test('management inventory is server-wide and preserves identity, flags, ownership and blank control dimensions', async () => {
  const own = { ...client, name: 'client-own', pid: 301, session: 'other', tty: '', term: '', flags: ['control-mode', 'ignore-size'], control: true }
  const calls: string[][] = []
  const run: TmuxRunner = async (bin, args) => {
    assert.equal(bin, '/configured/tmux')
    calls.push(args)
    return clientLine(client) + clientLine(own).replace('\t120\t40\t', '\t\t\t')
  }
  assert.deepEqual(await listAttachedClientsCli('/configured/tmux', own.name, run), [client, { ...own, cols: 0, rows: 0, own: true }])
  assert.deepEqual(calls[0].slice(0, 2), ['list-clients', '-F'])
  assert.equal(calls[0].includes('-t'), false)
  assert.deepEqual(await listSessionsCli('fake', async () => ' space name \t2\t3\n'), [{ name: ' space name ', attached: 2, windows: 3 }])
  await assert.rejects(listAttachedClientsCli('fake', '', async () => 'malformed\n'), /invalid tmux client inventory/)
  await assert.rejects(listSessionsCli('fake', async () => 'name\tbroken\t2\n'), /invalid tmux inventory/)
})

test('only specific no-server errors yield empty inventory; other failures propagate', async () => {
  for (const stderr of ['no server running on /tmp/isolated\n', 'error connecting to /tmp/isolated (No such file or directory)\n']) {
    const error = Object.assign(new Error(stderr), { code: 1, stderr })
    assert.equal(isNoTmuxServer(error), true)
    const run: TmuxRunner = async () => { throw error }
    assert.deepEqual(await listSessionsCli('fake', run), [])
    assert.deepEqual(await listAttachedClientsCli('fake', '', run), [])
  }
  for (const error of [
    Object.assign(new Error('missing executable'), { code: 'ENOENT', stderr: '' }),
    Object.assign(new Error('permission denied'), { code: 1, stderr: 'error connecting to /tmp/server (Permission denied)\n' }),
    Object.assign(new Error('unknown format'), { code: 1, stderr: 'unknown command: list-clients\n' }),
    Object.assign(new Error('timeout'), { code: null, killed: true, stderr: '' }),
    Object.assign(new Error('different failure'), { code: 2, stderr: 'no server running on /tmp/x\n' }),
  ]) {
    assert.equal(isNoTmuxServer(error), false)
    const run: TmuxRunner = async () => { throw error }
    await assert.rejects(listSessionsCli('fake', run), error)
    await assert.rejects(listAttachedClientsCli('fake', '', run), error)
  }
})

test('rename uses exact session target and creation supplies only configured shell argv', async () => {
  const calls: string[][] = []
  const manager = new TmuxManagement('fake', () => '', async (_bin, args) => {
    calls.push(args)
    return args[0] === 'start-server' ? '/bin/sh\n' : ''
  })
  await manager.rename('*glob', '-new name')
  assert.deepEqual(calls.shift(), ['rename-session', '-t', '=*glob', '--', '-new name'])
  await manager.create('-literal')
  assert.deepEqual(calls, [
    ['start-server', ';', 'show-options', '-gqv', 'default-shell'],
    ['new-session', '-d', '-s', '-literal', '--', '/bin/sh', '-l'],
  ])
  calls.length = 0
  await assert.rejects(manager.create('bad;kill-server'), /session name/)
  await assert.rejects(manager.rename('bad;', 'good'), /session name/)
  await assert.rejects(manager.create('good', '.'), /absolute/)
  assert.deepEqual(calls, [])
})

test('detach rejects stale, prefix, own and mixed selections before any mutation', async () => {
  const own = { ...client, name: 'own', pid: 301 }
  const calls: string[][] = []
  const manager = new TmuxManagement('fake', () => own.name, async (_bin, args) => {
    calls.push(args)
    return clientLine(client) + clientLine(own)
  })
  for (const selected of [
    [{ ...client, name: '/dev/pts' }], [{ ...client, pid: client.pid + 1 }], [{ ...client, created: client.created + 1 }],
    [own], [client, own], [client, { ...client, name: 'missing' }],
  ]) await assert.rejects(manager.detach(selected), /stale|shared dock/)
  assert.ok(calls.every(args => args[0] === 'list-clients'))
})

test('detach rechecks between selected targets and uses only guarded exact client commands', async () => {
  const other = { ...client, name: 'client-400', pid: 400 }
  const calls: string[][] = []
  let inventoryCalls = 0
  const manager = new TmuxManagement('fake', () => '', async (_bin, args) => {
    calls.push(args)
    if (args[0] !== 'list-clients') return ''
    inventoryCalls += 1
    return inventoryCalls < 3 ? clientLine(client) + clientLine(other) : clientLine({ ...other, created: other.created + 1 })
  })
  await assert.rejects(manager.detach([client, other]), /stale/)
  const writes = calls.filter(args => args[0] !== 'list-clients')
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0], 'if-shell')
  assert.equal(writes[0][1], '-F', 'format mode must never execute a shell')
  assert.match(writes[0][2], /client_name/)
  assert.match(writes[0][2], /client_pid/)
  assert.match(writes[0][2], /client_created/)
  assert.equal(writes[0][3], "detach-client -t '/dev/pts/3'")
  assert.equal(writes[0][4], 'display-message -p DSH_CLIENT_STALE')
})

class WireSocket implements SocketLike {
  sent: HostToClient[] = []
  handler: ((data: string) => void) | undefined
  send(data: string): void { this.sent.push(JSON.parse(data) as HostToClient) }
  close(): void {}
  on(event: 'message' | 'close', handler: ((data: string) => void) | (() => void)): void {
    if (event === 'message') this.handler = handler
  }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve))
const emptySnapshot: Snapshot = {
  session: '', windowId: '', windowName: '', cols: 80, rows: 24, zoomed: false, attached: false,
  panes: [], sessions: [], windows: [], layouts: [], viewers: 0, sizeMode: 'mirror', sizePolicy: 'auto',
}

test('wire malformed and operational errors echo requestId; inventory works without attachment', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: '/must-not-run' })
  runtime.snapshot = async () => emptySnapshot
  const internals = runtime as unknown as { management: TmuxManagement }
  internals.management = new TmuxManagement('fake', () => '', async () => { throw new Error('inventory denied') })
  const socket = new WireSocket()
  runtime.bind(socket)
  for (const [requestId, request] of [
    ['malformed', { type: 'create-session', name: 'bad;' }],
    ['bad-clients', { type: 'detach-clients', clients: [null] }],
    ['native-failure', { type: 'management' }],
  ] as const) {
    socket.handler!(JSON.stringify({ ...request, requestId }))
    await tick()
    const error = socket.sent.find(message => message.type === 'error' && message.requestId === requestId)
    assert.ok(error, `error for ${requestId} must be correlated`)
  }
  for (const raw of ['null', '[]', 'not-json']) socket.handler!(raw)
  await tick()
  assert.equal(socket.sent.filter(msg => msg.type === 'error' && msg.requestId === undefined).length, 3)
  internals.management = new TmuxManagement('fake', () => '', async () => '')
  socket.handler!(JSON.stringify({ type: 'management', requestId: 'recovery' }))
  await tick()
  assert.deepEqual(socket.sent.at(-1), { type: 'management', requestId: 'recovery', sessions: [], clients: [] })
  runtime.dispose()
})

test('create and rename reject names shadowing a configured layout recipe before running tmux', async () => {
  const runtime = new TmuxRuntime({
    tmuxBin: '/must-not-run',
    layouts: [
      { id: 'reserved', label: 'Recipe', session: 'recipe-session' },
      { id: 'same', label: 'Literal', session: 'same' },
    ],
  })
  runtime.snapshot = async () => emptySnapshot
  const calls: string[][] = []
  const internals = runtime as unknown as { management: TmuxManagement }
  internals.management = new TmuxManagement('fake', () => '', async (_bin, args) => {
    calls.push(args)
    return args[0] === 'start-server' ? '/bin/sh\n' : ''
  })
  const socket = new WireSocket()
  runtime.bind(socket)
  for (const request of [
    { type: 'create-session', requestId: 'reserved-create', name: 'reserved' },
    { type: 'rename-session', requestId: 'reserved-rename', session: 'old', newName: 'reserved' },
  ]) {
    socket.handler!(JSON.stringify(request))
    await tick()
    const error = socket.sent.find(message => message.type === 'error' && message.requestId === request.requestId)
    assert.ok(error && error.type === 'error')
    assert.match(error.message, /reserved by a layout recipe/)
  }
  assert.deepEqual(calls, [])
  socket.handler!(JSON.stringify({ type: 'create-session', requestId: 'literal-layout', name: 'same' }))
  await tick()
  assert.ok(calls.some(args => args[0] === 'new-session'))
  assert.ok(socket.sent.some(message => message.type === 'management' && message.requestId === 'literal-layout'))
  runtime.dispose()
})

test('management serializes mutation, refresh, and response across sockets and recovers after failure', async () => {
  const runtime = new TmuxRuntime({ tmuxBin: '/must-not-run' })
  const order: string[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let gateFirst = true
  runtime.snapshot = async () => { order.push('snapshot'); return emptySnapshot }
  const internals = runtime as unknown as { management: TmuxManagement; handle(socket: SocketLike, raw: string): Promise<void> }
  internals.management = new TmuxManagement('fake', () => '', async (_bin, args) => {
    order.push(args[0])
    if (args[0] === 'rename-session' && gateFirst) { gateFirst = false; await gate }
    return ''
  })
  const first = new WireSocket()
  const second = new WireSocket()
  const a = internals.handle(first, JSON.stringify({ type: 'rename-session', requestId: 'a', session: 'old', newName: 'new' }))
  const b = internals.handle(second, JSON.stringify({ type: 'management', requestId: 'b' }))
  await tick()
  assert.deepEqual(order, ['rename-session'])
  release()
  await Promise.all([a, b])
  assert.deepEqual(order, ['rename-session', 'snapshot', 'list-sessions', 'list-clients', 'list-sessions', 'list-clients'])
  assert.equal(first.sent.at(-1)?.type, 'management')
  assert.equal(second.sent.at(-1)?.type, 'management')
  runtime.dispose()
})
