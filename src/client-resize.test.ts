import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function functionSource(name: string): string {
  const match = clientSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`))
  assert.ok(match, `missing ${name}`)
  return match[0]
}

type Pointer = {
  pointerId: number
  pointerType: 'mouse' | 'touch' | 'pen'
  button: number
  isPrimary: boolean
  clientX: number
  clientY: number
  prevented: boolean
  preventDefault(): void
}
type Listener = { fn: (event: Pointer) => void; capture: boolean }
type Pane = { id: string; width: number; height: number }

function pointer(patch: Partial<Pointer> = {}): Pointer {
  return {
    pointerId: 7, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 100, clientY: 100,
    prevented: false,
    preventDefault() { this.prevented = true },
    ...patch,
  }
}

class FakeTarget {
  dataset: Record<string, string> = {}
  isConnected = true
  _tmuxPane?: Pane
  listeners = new Map<string, Listener[]>()
  captured: number[] = []
  released: number[] = []
  captureFails = false
  setPointerCapture: ((id: number) => void) | undefined = (id) => {
    this.captured.push(id)
    if (this.captureFails) throw new Error('capture unavailable')
  }
  releasePointerCapture: ((id: number) => void) | undefined = (id) => {
    this.released.push(id)
    // Some implementations can deliver lostcapture immediately on release.
    this.dispatch('lostpointercapture', pointer({ pointerId: id }))
    if (this.captureFails) throw new Error('already released')
  }
  addEventListener(type: string, fn: Listener['fn'], capture = false): void {
    const list = this.listeners.get(type) ?? []
    if (!list.some(entry => entry.fn === fn && entry.capture === capture)) list.push({ fn, capture })
    this.listeners.set(type, list)
  }
  removeEventListener(type: string, fn: Listener['fn'], capture = false): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry.fn !== fn || entry.capture !== capture))
  }
  dispatch(type: string, event = pointer()): Pointer {
    for (const { fn } of [...(this.listeners.get(type) ?? [])]) fn(event)
    return event
  }
  listenerCount(): number {
    return [...this.listeners.values()].reduce((total, entries) => total + entries.length, 0)
  }
  getBoundingClientRect(): { width: number; height: number } { return { width: 1000, height: 200 } }
}

type Kind = 'sash' | 'dock'

function fixture(kind: Kind, axis: 'x' | 'y' = 'x', side: 'right' | 'bottom' = 'bottom') {
  const window = new FakeTarget()
  const document = { body: new FakeTarget() }
  const handle = new FakeTarget()
  const body = new FakeTarget()
  const state = {
    prefs: { side, size: 300 },
    snapshot: { cols: 100, rows: 20, attached: true } as { cols: number; rows: number; attached: boolean } | null,
  }
  let narrow = false
  const sent: unknown[] = []
  const localSizes: number[] = []
  let flushes = 0
  const store = {
    get: () => state,
    send: (message: unknown) => { sent.push(message) },
    setLocal: (patch: { size: number }) => { state.prefs.size = patch.size; localSizes.push(patch.size) },
    setPrefs: (patch: Record<string, unknown>) => {
      assert.deepEqual(patch, {})
      assert.equal(document.body.dataset.dshTmuxDragging, undefined, 'redraw runs only after drag ownership is released')
      assert.equal(handle.dataset.active, undefined)
      flushes += 1
    },
  }
  const observers: FakeObserver[] = []
  class FakeObserver {
    active = false
    callback: () => void
    constructor(callback: () => void) { this.callback = callback; observers.push(this) }
    observe(target: FakeTarget, options: { childList: boolean; subtree: boolean }): void {
      assert.equal(target, document.body)
      assert.deepEqual(options, { childList: true, subtree: true })
      this.active = true
    }
    disconnect(): void { this.active = false }
  }
  const bind = Function('window', 'document', 'isNarrowViewport', 'clampSize', 'MutationObserver', `
    ${functionSource('bindSash')}
    ${functionSource('bindDockResize')}
    return { bindSash, bindDockResize }
  `)(window, document, () => narrow, (_side: string, size: number) => Math.max(180, size), FakeObserver) as {
    bindSash(target: FakeTarget, store: unknown, pane: Pane, axis: string, body: FakeTarget): () => void
    bindDockResize(target: FakeTarget, store: unknown): () => void
  }
  const dispose = kind === 'sash'
    ? bind.bindSash(handle, store, { id: '%1', width: 20, height: 10 }, axis, body)
    : bind.bindDockResize(handle, store)
  return {
    window, document, handle, body, state, sent, localSizes, observers, dispose,
    setNarrow: (value: boolean) => { narrow = value },
    flushes: () => flushes,
    mutations: () => { for (const observer of observers) if (observer.active) observer.callback() },
  }
}

for (const kind of ['sash', 'dock'] as const) {
  test(`${kind} resize only starts for a primary left pointer on a connected handle`, () => {
    const f = fixture(kind)
    for (const patch of [{ button: 1 }, { button: 2 }, { isPrimary: false }]) {
      assert.equal(f.handle.dispatch('pointerdown', pointer(patch)).prevented, false)
    }
    f.handle.isConnected = false
    assert.equal(f.handle.dispatch('pointerdown').prevented, false)
    f.handle.isConnected = true
    f.document.body.dataset.dshTmuxDragging = '1'
    assert.equal(f.handle.dispatch('pointerdown').prevented, false)
    assert.equal(f.document.body.dataset.dshTmuxDragging, '1', 'a rejected start must not clear another drag')
    assert.equal(f.window.listenerCount(), 0)
    assert.equal(f.handle.captured.length, 0)
    assert.equal(f.flushes(), 0)
  })

  test(`${kind} resize captures one pointer and ignores duplicate starts and unrelated pointer events`, () => {
    const f = fixture(kind)
    assert.equal(f.handle.dispatch('pointerdown').prevented, true)
    f.handle.dispatch('pointerdown', pointer({ clientX: 900, clientY: 900 }))
    f.handle.dispatch('pointerdown', pointer({ pointerId: 9 }))
    assert.deepEqual(f.handle.captured, [7])
    assert.equal(f.window.listenerCount(), 4)
    for (const entries of f.window.listeners.values()) assert.ok(entries.every(entry => entry.capture))
    for (const event of ['pointermove', 'pointerup', 'pointercancel']) {
      f.window.dispatch(event, pointer({ pointerId: 9, clientX: 900, clientY: 900 }))
    }
    f.handle.dispatch('lostpointercapture', pointer({ pointerId: 9 }))
    assert.equal(f.document.body.dataset.dshTmuxDragging, '1')
    assert.deepEqual(f.sent, [])
    assert.deepEqual(f.localSizes, [])
    f.window.dispatch('pointermove', pointer({ clientX: 120, clientY: 120 }))
    if (kind === 'sash') assert.deepEqual(f.sent, [{ type: 'resize-pane', pane: '%1', width: 22 }])
    else assert.deepEqual(f.localSizes, [280])
    f.window.dispatch('pointerup')
    assert.equal(f.flushes(), 1)
  })

  for (const ending of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'disconnect', 'dispose'] as const) {
    test(`${kind} resize ${ending} clears flags and listeners and redraws exactly once`, () => {
      const f = fixture(kind)
      f.handle.dispatch('pointerdown')
      assert.equal(f.document.body.dataset.dshTmuxDragging, '1')
      assert.equal(f.handle.dataset.active, '1')
      assert.equal(f.observers.filter(observer => observer.active).length, 1)
      if (ending === 'disconnect') {
        f.handle.isConnected = false
        f.mutations()
      } else if (ending === 'dispose') f.dispose()
      else if (ending === 'lostpointercapture') f.handle.dispatch(ending)
      else f.window.dispatch(ending)
      assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
      assert.equal(f.handle.dataset.active, undefined)
      assert.equal(f.window.listenerCount(), 0)
      assert.equal(f.handle.listenerCount(), ending === 'dispose' ? 0 : 1)
      assert.equal(f.observers.some(observer => observer.active), false)
      assert.deepEqual(f.handle.released, [7])
      f.window.dispatch('pointerup')
      f.window.dispatch('pointercancel')
      f.window.dispatch('blur')
      f.window.dispatch('pointermove', pointer({ clientX: 900, clientY: 900 }))
      f.handle.dispatch('lostpointercapture')
      f.mutations()
      assert.equal(f.flushes(), 1)
      assert.deepEqual(f.sent, [])
      assert.deepEqual(f.localSizes, [])
      f.dispose()
      f.dispose()
      assert.equal(f.flushes(), 1, 'disposing after an ending is also idempotent')
    })
  }

  test(`${kind} resize can restart after cancellation and tolerates missing or failed pointer capture`, () => {
    for (const capture of ['missing', 'throws'] as const) {
      const f = fixture(kind)
      if (capture === 'missing') {
        f.handle.setPointerCapture = undefined
        f.handle.releasePointerCapture = undefined
      } else f.handle.captureFails = true
      f.handle.dispatch('pointerdown')
      f.window.dispatch('pointercancel')
      f.handle.dispatch('pointerdown', pointer({ pointerId: 8 }))
      f.window.dispatch('pointerup', pointer({ pointerId: 7 }))
      assert.equal(f.document.body.dataset.dshTmuxDragging, '1')
      f.window.dispatch('pointerup', pointer({ pointerId: 8 }))
      assert.equal(f.flushes(), 2)
      assert.equal(f.window.listenerCount(), 0)
    }
  })

  test(`${kind} resize stops safely if the handle disconnects during a move`, () => {
    const f = fixture(kind)
    f.handle.dispatch('pointerdown')
    f.handle.isConnected = false
    f.window.dispatch('pointermove', pointer({ clientX: 900, clientY: 900 }))
    assert.deepEqual(f.sent, [])
    assert.deepEqual(f.localSizes, [])
    assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
    assert.equal(f.handle.dataset.active, undefined)
    assert.equal(f.flushes(), 1)
    assert.equal(f.window.listenerCount(), 0)
  })
}

for (const axis of ['x', 'y'] as const) {
  test(`narrow touch sash resize starts on the ${axis} axis and sends directional cell counts`, () => {
    const f = fixture('sash', axis)
    f.setNarrow(true)
    // Unequal cell dimensions catch using the wrong axis for either pixels or cells.
    f.body.getBoundingClientRect = () => ({ width: 500, height: 400 })
    const touch = (patch: Partial<Pointer> = {}) => pointer({ pointerType: 'touch', ...patch })
    assert.equal(f.handle.dispatch('pointerdown', touch({ isPrimary: false })).prevented, false)
    assert.equal(f.handle.dispatch('pointerdown', touch()).prevented, true)
    assert.equal(f.document.body.dataset.dshTmuxDragging, '1')
    assert.equal(f.handle.dataset.active, '1')
    assert.deepEqual(f.handle.captured, [7])
    f.window.dispatch('pointermove', touch(axis === 'x' ? { clientY: 160 } : { clientX: 115 }))
    assert.deepEqual(f.sent, [], 'movement along the other axis does not resize the pane')
    f.window.dispatch('pointermove', touch(axis === 'x' ? { clientX: 115 } : { clientY: 160 }))
    f.window.dispatch('pointermove', touch(axis === 'x' ? { clientX: 116 } : { clientY: 161 }))
    f.window.dispatch('pointermove', touch(axis === 'x' ? { clientX: 90 } : { clientY: 60 }))
    f.window.dispatch('pointermove', touch(axis === 'x' ? { clientX: -900 } : { clientY: -900 }))
    assert.deepEqual(f.sent, axis === 'x' ? [
      { type: 'resize-pane', pane: '%1', width: 23 },
      { type: 'resize-pane', pane: '%1', width: 18 },
      { type: 'resize-pane', pane: '%1', width: 4 },
    ] : [
      { type: 'resize-pane', pane: '%1', height: 13 },
      { type: 'resize-pane', pane: '%1', height: 8 },
      { type: 'resize-pane', pane: '%1', height: 4 },
    ])
    assert.deepEqual(f.localSizes, [], 'pane resizing never changes the dock size')
    f.window.dispatch('pointerup', touch())
    assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
    assert.equal(f.handle.dataset.active, undefined)
    assert.equal(f.flushes(), 1)
    assert.equal(f.window.listenerCount(), 0)
  })

  test(`touch sash resize on the ${axis} axis survives crossing the narrow breakpoint in both directions`, () => {
    for (const startsNarrow of [false, true]) {
      const f = fixture('sash', axis)
      f.setNarrow(startsNarrow)
      const touch = (coordinate: number) => pointer({
        pointerType: 'touch',
        ...(axis === 'x' ? { clientX: coordinate } : { clientY: coordinate }),
      })
      assert.equal(f.handle.dispatch('pointerdown', touch(100)).prevented, true)
      for (const [index, narrow] of [startsNarrow, !startsNarrow, startsNarrow].entries()) {
        f.setNarrow(narrow)
        f.window.dispatch('pointermove', touch(110 + index * 10))
        assert.equal(f.document.body.dataset.dshTmuxDragging, '1')
        assert.equal(f.handle.dataset.active, '1')
        assert.equal(f.window.listenerCount(), 4)
        assert.equal(f.flushes(), 0, 'crossing a breakpoint must not end pane resizing')
        assert.deepEqual(f.handle.released, [])
      }
      assert.deepEqual(f.sent, [1, 2, 3].map(delta => axis === 'x'
        ? { type: 'resize-pane', pane: '%1', width: 20 + delta }
        : { type: 'resize-pane', pane: '%1', height: 10 + delta }))
      assert.deepEqual(f.handle.captured, [7], 'the original pointer capture lasts across breakpoints')
      f.window.dispatch('pointerup', touch(130))
      assert.deepEqual(f.handle.released, [7])
      assert.equal(f.handle.dataset.active, undefined)
      assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
      assert.equal(f.window.listenerCount(), 0)
      assert.equal(f.flushes(), 1)
    }
  })

  test(`narrow touch sash resize on the ${axis} axis can repeat after cancel, lostcapture, and release without leaks`, () => {
    const f = fixture('sash', axis)
    f.setNarrow(true)
    const pointerIds: number[] = []
    const endings = ['pointercancel', 'lostpointercapture', 'pointerup'] as const
    for (const [index, ending] of [...endings, ...endings].entries()) {
      const pointerId = 7 + index
      const touch = (patch: Partial<Pointer> = {}) => pointer({ pointerId, pointerType: 'touch', ...patch })
      pointerIds.push(pointerId)
      assert.equal(f.handle.dispatch('pointerdown', touch()).prevented, true)
      assert.equal(f.handle.dispatch('pointerdown', touch({ pointerId: 99 })).prevented, false)
      assert.deepEqual(f.handle.captured, pointerIds)
      assert.equal(f.window.listenerCount(), 4)
      assert.equal(f.handle.listenerCount(), 2)
      assert.equal(f.observers.filter(observer => observer.active).length, 1)
      f.window.dispatch('pointercancel', touch({ pointerId: pointerId - 1 }))
      f.handle.dispatch('lostpointercapture', touch({ pointerId: pointerId - 1 }))
      assert.equal(f.document.body.dataset.dshTmuxDragging, '1', 'stale events must not finish the new drag')
      assert.equal(f.handle.dataset.active, '1')
      f.window.dispatch('pointermove', touch(axis === 'x' ? { clientX: 120 } : { clientY: 120 }))
      assert.equal(f.sent.length, index + 1)
      assert.deepEqual(f.sent[index], axis === 'x'
        ? { type: 'resize-pane', pane: '%1', width: 22 }
        : { type: 'resize-pane', pane: '%1', height: 12 })
      if (ending === 'lostpointercapture') f.handle.dispatch(ending, touch())
      else f.window.dispatch(ending, touch())
      assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
      assert.equal(f.handle.dataset.active, undefined)
      assert.equal(f.window.listenerCount(), 0)
      assert.equal(f.handle.listenerCount(), 1)
      assert.equal(f.observers.some(observer => observer.active), false)
      assert.deepEqual(f.handle.released, pointerIds)
      f.window.dispatch('pointerup', touch())
      f.window.dispatch('pointercancel', touch())
      f.handle.dispatch('lostpointercapture', touch())
      f.window.dispatch('pointermove', touch({ clientX: 900, clientY: 900 }))
      f.mutations()
      assert.equal(f.sent.length, index + 1, 'events after cleanup must not send more sizes')
      assert.equal(f.flushes(), index + 1, 'each drag redraws exactly once even with duplicate endings')
    }
    f.dispose()
    f.dispose()
    assert.equal(f.handle.listenerCount(), 0)
    assert.equal(f.flushes(), endings.length * 2)
  })
}

for (const side of ['right', 'bottom'] as const) {
  test(`narrow viewport still rejects mouse and touch ${side} dock resize starts`, () => {
    const f = fixture('dock', 'x', side)
    f.setNarrow(true)
    for (const pointerType of ['mouse', 'touch'] as const) {
      assert.equal(f.handle.dispatch('pointerdown', pointer({ pointerType })).prevented, false)
    }
    assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
    assert.equal(f.handle.dataset.active, undefined)
    assert.equal(f.window.listenerCount(), 0)
    assert.equal(f.handle.listenerCount(), 1)
    assert.deepEqual(f.handle.captured, [])
    assert.deepEqual(f.sent, [])
    assert.deepEqual(f.localSizes, [])
    assert.equal(f.flushes(), 0)
  })

  test(`${side} dock resize still cancels when crossing into a narrow viewport`, () => {
    const f = fixture('dock', 'x', side)
    const touch = (patch: Partial<Pointer> = {}) => pointer({ pointerType: 'touch', ...patch })
    assert.equal(f.handle.dispatch('pointerdown', touch()).prevented, true)
    f.window.dispatch('pointermove', touch({ clientX: 80, clientY: 60 }))
    const lastSize = side === 'right' ? 320 : 340
    assert.deepEqual(f.localSizes, [lastSize])
    f.setNarrow(true)
    f.window.dispatch('pointermove', touch({ clientX: 900, clientY: 900 }))
    assert.deepEqual(f.localSizes, [lastSize], 'breakpoint cancellation preserves the last desktop dock size')
    assert.equal(f.state.prefs.size, lastSize)
    assert.deepEqual(f.sent, [])
    assert.equal(f.document.body.dataset.dshTmuxDragging, undefined)
    assert.equal(f.handle.dataset.active, undefined)
    assert.equal(f.window.listenerCount(), 0)
    assert.equal(f.handle.listenerCount(), 1)
    assert.equal(f.observers.some(observer => observer.active), false)
    assert.deepEqual(f.handle.released, [7])
    f.window.dispatch('pointerup', touch())
    f.handle.dispatch('lostpointercapture', touch())
    assert.equal(f.flushes(), 1)
  })
}

test('sash resize uses the latest pane, preserves both axes, clamps cells, and coalesces unchanged sizes', () => {
  for (const axis of ['x', 'y'] as const) {
    const f = fixture('sash', axis)
    f.handle._tmuxPane = { id: '%2', width: 30, height: 15 }
    f.handle.dispatch('pointerdown')
    f.window.dispatch('pointermove', pointer({ clientX: 120, clientY: 120 }))
    f.window.dispatch('pointermove', pointer({ clientX: 121, clientY: 121 }))
    f.window.dispatch('pointermove', pointer({ clientX: -900, clientY: -900 }))
    assert.deepEqual(f.sent, axis === 'x' ? [
      { type: 'resize-pane', pane: '%2', width: 32 },
      { type: 'resize-pane', pane: '%2', width: 4 },
    ] : [
      { type: 'resize-pane', pane: '%2', height: 17 },
      { type: 'resize-pane', pane: '%2', height: 4 },
    ])
    f.window.dispatch('pointerup')
  }
})

test('sash resize rejects a missing snapshot and cleans up when its body is removed', () => {
  const f = fixture('sash')
  const snapshot = f.state.snapshot
  f.state.snapshot = null
  assert.equal(f.handle.dispatch('pointerdown').prevented, false)
  assert.equal(f.window.listenerCount(), 0)
  f.state.snapshot = snapshot
  f.handle.dispatch('pointerdown')
  f.body.isConnected = false
  f.mutations()
  assert.equal(f.flushes(), 1)
  assert.equal(f.window.listenerCount(), 0)
})

test('dock resize keeps the last local size on cancellation for both dock sides', () => {
  for (const side of ['right', 'bottom'] as const) {
    const f = fixture('dock', 'x', side)
    f.handle.dispatch('pointerdown')
    f.window.dispatch('pointermove', pointer({ clientX: 80, clientY: 60 }))
    assert.deepEqual(f.localSizes, [side === 'right' ? 320 : 340])
    f.window.dispatch('pointercancel')
    assert.equal(f.state.prefs.size, side === 'right' ? 320 : 340)
    assert.deepEqual(f.sent, [], 'dock size never sends pane resize commands')
    assert.equal(f.flushes(), 1)
  }
})
