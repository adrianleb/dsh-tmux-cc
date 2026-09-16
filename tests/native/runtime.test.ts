import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { TmuxRuntime, type SocketLike } from '../../src/runtime.ts'
import type { ClientToHost, HostToClient, PaneInfo } from '../../src/types.ts'

// Opt in explicitly: node --experimental-strip-types --test tests/native/*.test.ts
// Requires a real tmux executable (override its path with TMUX_BIN). No command
// reaches the default server: setup, runtime, inspection, and cleanup all use
// the same temporary wrapper, which unconditionally supplies a unique -L name.
const execFileAsync = promisify(execFile)

class RecordingSocket implements SocketLike {
  sent: HostToClient[] = []
  send(data: string): void { this.sent.push(JSON.parse(data) as HostToClient) }
  close(): void { /* runtime owns cleanup */ }
  on(_event: 'message' | 'close', _fn: ((data: string) => void) | (() => void)): void { /* dispatch is awaited directly */ }
}

type NativePane = Pick<PaneInfo, 'id' | 'left' | 'top' | 'width' | 'height' | 'active'> & { windowId: string }

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function box(pane: Pick<PaneInfo, 'left' | 'top' | 'width' | 'height'>) {
  return { left: pane.left, top: pane.top, width: pane.width, height: pane.height }
}

test('real isolated tmux swaps pane geometry without moving focus and rejects foreign panes', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-tmux-native-'))
  const socketName = `dsh-tmux-native-${process.pid}-${randomUUID()}`
  const wrapper = join(directory, 'tmux-isolated')
  const session = 'native-swap'
  let wrapperReady = false
  let runtime: TmuxRuntime | null = null
  const tmux = async (...args: string[]): Promise<string> => {
    const { stdout } = await execFileAsync(wrapper, args, { timeout: 5000 })
    return stdout.trim()
  }
  const nativePanes = async (): Promise<NativePane[]> => {
    const raw = await tmux('list-panes', '-a', '-F', '#{pane_id}\t#{window_id}\t#{pane_left}\t#{pane_top}\t#{pane_width}\t#{pane_height}\t#{pane_active}')
    return raw.split('\n').map((line) => {
      const [id, windowId, left, top, width, height, active] = line.split('\t')
      return { id, windowId, left: Number(left), top: Number(top), width: Number(width), height: Number(height), active: active === '1' }
    }).sort((a, b) => a.id.localeCompare(b.id))
  }

  try {
    await writeFile(wrapper, `#!/bin/sh\nunset TMUX TMUX_PANE\nexec ${shellQuote(process.env.TMUX_BIN || 'tmux')} -L ${shellQuote(socketName)} -f /dev/null "$@"\n`, { mode: 0o700 })
    wrapperReady = true
    const sourceId = await tmux('new-session', '-d', '-s', session, '-x', '100', '-y', '30', '-P', '-F', '#{pane_id}', 'sleep 120')
    // Runtime-created panes must also be inert, not interactive login shells.
    await tmux('set-option', '-g', 'default-command', 'sleep 120')
    const targetId = await tmux('split-window', '-h', '-d', '-t', sourceId, '-P', '-F', '#{pane_id}', 'sleep 120')
    // A real pane in another window proves membership validation is stronger
    // than merely checking that a syntactically valid pane ID exists in tmux.
    const foreignId = await tmux('new-window', '-d', '-t', `=${session}`, '-P', '-F', '#{pane_id}', 'sleep 120')
    await tmux('select-pane', '-t', sourceId)
    const original = await nativePanes()
    const sourceBefore = original.find(pane => pane.id === sourceId)!
    const targetBefore = original.find(pane => pane.id === targetId)!
    assert.ok(sourceBefore)
    assert.ok(targetBefore)
    assert.equal(sourceBefore.windowId, targetBefore.windowId)
    assert.notEqual(original.find(pane => pane.id === foreignId)?.windowId, sourceBefore.windowId)
    assert.equal(sourceBefore.active, true)
    assert.notDeepEqual(box(sourceBefore), box(targetBefore))

    runtime = new TmuxRuntime({ tmuxBin: wrapper, sizePolicy: 'mirror' })
    const attached = await runtime.attach(session)
    assert.equal(attached.attached, true)
    assert.equal(attached.windowId, sourceBefore.windowId)
    assert.deepEqual(attached.panes.map(pane => pane.id).sort(), [sourceId, targetId].sort())
    assert.equal(attached.panes.find(pane => pane.active)?.id, sourceId)

    const socket = new RecordingSocket()
    runtime.bind(socket)
    const internals = runtime as unknown as {
      handle(socket: SocketLike, raw: string): Promise<void>
    }
    const dispatch = (message: ClientToHost) => internals.handle(socket, JSON.stringify(message))

    await dispatch({ type: 'swap', pane: sourceId, target: targetId })
    const swapped = await nativePanes()
    const sourceAfter = swapped.find(pane => pane.id === sourceId)!
    const targetAfter = swapped.find(pane => pane.id === targetId)!
    assert.deepEqual(box(sourceAfter), box(targetBefore), 'source pane occupies the old target rectangle')
    assert.deepEqual(box(targetAfter), box(sourceBefore), 'target pane occupies the old source rectangle')
    assert.equal(sourceAfter.active, true, '-d keeps focus on the same pane ID')
    assert.equal(targetAfter.active, false)
    assert.deepEqual(swapped.find(pane => pane.id === foreignId), original.find(pane => pane.id === foreignId))

    const snapshot = await runtime.snapshot()
    assert.equal(snapshot.windowId, sourceBefore.windowId)
    assert.equal(snapshot.panes.find(pane => pane.active)?.id, sourceId)
    for (const pane of snapshot.panes) {
      assert.deepEqual(box(pane), box(swapped.find(native => native.id === pane.id)!))
    }
    // refreshSnapshot emits through the ordinary runtime broadcast path too.
    await new Promise<void>(resolve => setImmediate(resolve))
    const broadcasts = socket.sent.filter((message): message is Extract<HostToClient, { type: 'snapshot' }> => message.type === 'snapshot')
    assert.ok(broadcasts.length > 0)
    assert.deepEqual(broadcasts.at(-1)!.snapshot.panes, snapshot.panes)
    assert.deepEqual(socket.sent.filter(message => message.type === 'error'), [])

    for (const message of [
      { type: 'swap', pane: sourceId, target: foreignId },
      { type: 'swap', pane: foreignId, target: targetId },
      { type: 'swap', pane: sourceId, target: '%999999999' },
    ] satisfies ClientToHost[]) {
      await assert.rejects(dispatch(message), /visible in the attached tmux window/)
      assert.deepEqual(await nativePanes(), swapped, 'an invalid request cannot mutate either window')
    }
    await assert.rejects(dispatch({ type: 'swap', pane: sourceId, target: sourceId }), /cannot swap a pane with itself/)
    assert.deepEqual(await nativePanes(), swapped)

    // Exercise the opposite direction too: focus is now on the target ID, not
    // the source, so an implementation that always selects the source fails.
    await dispatch({ type: 'swap', pane: targetId, target: sourceId })
    assert.deepEqual(await nativePanes(), original)
    const restored = await runtime.snapshot()
    assert.equal(restored.panes.find(pane => pane.active)?.id, sourceId)
    assert.deepEqual(box(restored.panes.find(pane => pane.id === sourceId)!), box(sourceBefore))

    // A native split produces a third, active pane. Swapping the other two
    // must preserve its identity, rectangle, and focus in both directions.
    await dispatch({ type: 'split', pane: sourceId, dir: 'v' })
    const threePaneSnapshot = await runtime.snapshot()
    assert.equal(threePaneSnapshot.panes.length, 3)
    const activeThird = threePaneSnapshot.panes.find(pane => pane.active)!
    assert.ok(activeThird)
    assert.notEqual(activeThird.id, sourceId)
    assert.notEqual(activeThird.id, targetId)
    const threeBefore = await nativePanes()
    await dispatch({ type: 'swap', pane: sourceId, target: targetId })
    const threeAfter = await nativePanes()
    assert.deepEqual(threeAfter.find(pane => pane.id === activeThird.id), threeBefore.find(pane => pane.id === activeThird.id))
    assert.deepEqual(box(threeAfter.find(pane => pane.id === sourceId)!), box(threeBefore.find(pane => pane.id === targetId)!))
    assert.deepEqual(box(threeAfter.find(pane => pane.id === targetId)!), box(threeBefore.find(pane => pane.id === sourceId)!))
    const thirdSnapshot = await runtime.snapshot()
    assert.equal(thirdSnapshot.panes.find(pane => pane.active)?.id, activeThird.id)
    for (const pane of thirdSnapshot.panes) assert.deepEqual(box(pane), box(threeAfter.find(native => native.id === pane.id)!))
    await dispatch({ type: 'swap', pane: targetId, target: sourceId })
    assert.deepEqual(await nativePanes(), threeBefore)
    assert.equal((await runtime.snapshot()).panes.find(pane => pane.active)?.id, activeThird.id)
  } finally {
    try {
      runtime?.dispose()
    } finally {
      try {
        if (wrapperReady) {
          try { await tmux('kill-server') } catch (err) {
            // Setup may fail before a server exists, or it may already have
            // exited. Never fall back to an unscoped/default kill-server.
            if (!(err instanceof Error) || !/no server running|No such file or directory/.test(err.message)) throw err
          }
        }
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  }
})
