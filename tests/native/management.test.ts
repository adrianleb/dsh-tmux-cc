import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { TmuxRuntime, type SocketLike } from '../../src/runtime.ts'
import { TmuxControlClient } from '../../src/tmux-client.ts'
import { TmuxManagement } from '../../src/tmux-management.ts'
import type { HostToClient, ManagementRequest } from '../../src/types.ts'

const execFileAsync = promisify(execFile)
const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

class RecordingSocket implements SocketLike {
  sent: HostToClient[] = []
  send(data: string): void { this.sent.push(JSON.parse(data) as HostToClient) }
  close(): void {}
  on(_event: 'message' | 'close', _fn: ((data: string) => void) | (() => void)): void {}
}

test('isolated tmux management creates, renames, inventories and detaches only selected identities', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-tmux-management-'))
  const socketName = `dsh-management-${process.pid}-${randomUUID()}`
  const wrapper = join(directory, 'tmux-isolated')
  const cwd = join(directory, 'space #() #{session_name} dir')
  let ready = false
  let runtime: TmuxRuntime | undefined
  const seats: TmuxControlClient[] = []
  const tmux = async (...args: string[]) => (await execFileAsync(wrapper, args, { timeout: 5000 })).stdout.trim()
  try {
    // Every command (including cleanup and control attachments) goes through
    // this unique -L wrapper. Never inspect or mutate an operator server.
    await writeFile(wrapper, `#!/bin/sh\nunset TMUX TMUX_PANE\nexec ${shellQuote(process.env.TMUX_BIN || 'tmux')} -L ${shellQuote(socketName)} -f /dev/null "$@"\n`, { mode: 0o700 })
    ready = true
    await mkdir(cwd)
    runtime = new TmuxRuntime({ tmuxBin: wrapper, sizePolicy: 'mirror' })
    const socket = new RecordingSocket()
    const observer = new RecordingSocket()
    const internals = runtime as unknown as { handle(socket: SocketLike, raw: string): Promise<void> }
    const dispatch = (request: ManagementRequest) => internals.handle(socket, JSON.stringify(request))
    const response = () => socket.sent.filter((msg): msg is Extract<HostToClient, { type: 'management' }> => msg.type === 'management').at(-1)!
    runtime.bind(socket)
    runtime.bind(observer)
    await dispatch({ type: 'management', requestId: 'empty' })
    assert.deepEqual(response(), { type: 'management', requestId: 'empty', sessions: [], clients: [] })

    await dispatch({ type: 'create-session', requestId: 'create', name: 'alpha', cwd })
    assert.equal(response().requestId, 'create')
    assert.deepEqual(response().sessions, [{ name: 'alpha', attached: 0, windows: 1 }])
    assert.deepEqual(response().clients, [])
    assert.equal((await runtime.snapshot()).attached, false, 'create never attaches the shared dock')
    assert.equal(await tmux('display-message', '-p', '-t', '=alpha:', '#{pane_current_path}'), cwd)
    assert.match(await tmux('display-message', '-p', '-t', '=alpha:', '#{pane_start_command}'), / -l$/)

    // An explicitly argv-launched default shell bypasses default-command.
    await tmux('set-option', '-g', 'default-command', 'exit 77')
    await dispatch({ type: 'create-session', requestId: 'create-prefix', name: 'alpha-long' })
    assert.match(await tmux('display-message', '-p', '-t', '=alpha-long:', '#{pane_start_command}'), / -l$/)
    await assert.rejects(dispatch({ type: 'rename-session', requestId: 'prefix', session: 'alph', newName: 'wrong' }), /can't find session|session not found/)
    await assert.rejects(dispatch({ type: 'rename-session', requestId: 'glob', session: 'alpha*', newName: 'wrong' }), /can't find session|session not found/)
    await assert.rejects(dispatch({ type: 'create-session', requestId: 'duplicate', name: 'alpha' }), /duplicate session/)
    await assert.rejects(dispatch({ type: 'create-session', requestId: 'invalid-cwd', name: 'absent', cwd: join(directory, 'missing') }), /ENOENT/)

    await runtime.attach('alpha')
    await dispatch({ type: 'rename-session', requestId: 'rename', session: 'alpha', newName: '-renamed' })
    assert.equal(response().requestId, 'rename')
    assert.deepEqual(response().sessions.map(session => session.name).sort(), ['-renamed', 'alpha-long'])
    assert.equal((await runtime.snapshot()).session, '-renamed')
    assert.equal(runtime.getPrefs().session, '-renamed')
    assert.ok(observer.sent.some(message => message.type === 'snapshot' && message.snapshot.session === '-renamed'))
    assert.equal(response().clients.filter(client => client.own).length, 1)
    const own = response().clients.find(client => client.own)!
    assert.equal(own.control, true)
    assert.ok(own.pid > 0 && own.created > 0)
    assert.ok(own.flags.includes('control-mode'))
    assert.equal(own.session, '-renamed')

    for (const session of ['-renamed', 'alpha-long']) {
      const seat = new TmuxControlClient(wrapper)
      seat.on('error', () => {})
      seats.push(seat)
      await seat.attach(session)
    }
    await dispatch({ type: 'management', requestId: 'seats' })
    const clients = response().clients
    assert.equal(clients.length, 3, 'inventory covers clients on both sessions')
    const selected = clients.find(client => !client.own && client.session === '-renamed')!
    const untouched = clients.find(client => !client.own && client.session === 'alpha-long')!
    assert.ok(selected && untouched)
    await assert.rejects(dispatch({ type: 'detach-clients', requestId: 'own', clients: [selected, own] }), /shared dock control client/)
    await assert.rejects(dispatch({ type: 'detach-clients', requestId: 'stale-pid', clients: [{ ...selected, pid: selected.pid + 1 }] }), /stale/)
    await assert.rejects(dispatch({ type: 'detach-clients', requestId: 'stale-created', clients: [{ ...selected, created: selected.created + 1 }] }), /stale/)
    await dispatch({ type: 'management', requestId: 'unchanged' })
    assert.deepEqual(response().clients.map(client => client.name).sort(), clients.map(client => client.name).sort())
    await dispatch({ type: 'detach-clients', requestId: 'selected', clients: [selected] })
    assert.equal(response().requestId, 'selected')
    assert.deepEqual(response().clients.map(client => client.name).sort(), [own.name, untouched.name].sort())
    assert.equal((await runtime.snapshot()).attached, true)
    assert.equal(response().sessions.length, 2, 'detach does not kill sessions')
    await assert.rejects(dispatch({ type: 'detach-clients', requestId: 'stale-replay', clients: [selected] }), /stale/)

    // Once the dock is detached the other session's client remains manageable.
    runtime.detach()
    await dispatch({ type: 'management', requestId: 'dock-detached' })
    assert.ok(response().clients.some(client => client.name === untouched.name))
    assert.ok(response().clients.every(client => !client.own))
    await dispatch({ type: 'detach-clients', requestId: 'last-seat', clients: [untouched] })
    assert.deepEqual(response().clients, [])
    assert.equal(response().sessions.length, 2)

    // Simulate the narrow fresh-inventory -> mutation race: a changed identity
    // is rechecked by the format-only server-side guard and never detached.
    const seat = new TmuxControlClient(wrapper)
    seat.on('error', () => {})
    seats.push(seat)
    await seat.attach('alpha-long')
    const nativeManager = new TmuxManagement(wrapper, () => '')
    const identity = (await nativeManager.inventory()).clients[0]
    const guardedManager = new TmuxManagement(wrapper, () => '', async (_bin, args) => {
      if (args[0] === 'if-shell') args = args.map(arg => arg.replace(`#{client_created},${identity.created}`, `#{client_created},${identity.created + 1}`))
      return (await execFileAsync(wrapper, args, { timeout: 5000 })).stdout
    })
    await assert.rejects(guardedManager.detach([identity]), /changed before detach/)
    assert.equal((await nativeManager.inventory()).clients[0].name, identity.name)
  } finally {
    for (const seat of seats) seat.detach()
    runtime?.dispose()
    try {
      if (ready) {
        try { await tmux('kill-server') } catch (error) {
          if (!(error instanceof Error) || !/no server running|No such file or directory/.test(error.message)) throw error
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
})
