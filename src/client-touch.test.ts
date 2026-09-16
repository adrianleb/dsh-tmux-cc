import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { readFileSync } from 'node:fs'

// Exercise the real gesture owner with controlled animation time. Recording
// wheels alone misses stale flings, leaked paint guards and disposal failures.
const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function functionSource(name: string): string {
  const match = clientSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`))
  assert.ok(match, `missing ${name}`)
  return match[0]
}

type Listener = { fn: (ev: unknown) => void; capture: boolean; passive: boolean }
type ListenerOptions = { capture?: boolean; passive?: boolean } | boolean

type SyntheticWheel = {
  type: string
  deltaY: number
  deltaMode: number
  clientX: number
  clientY: number
  bubbles: boolean
  cancelable: boolean
}

type TouchPoint = { identifier: number; clientX: number; clientY: number }
type TouchLike = {
  timeStamp: number
  cancelable: boolean
  touches: TouchPoint[]
  prevented: boolean
  stopped: boolean
  preventDefault(): void
  stopPropagation(): void
}

function touchEvent(x: number, y: number, timeStamp: number, ended = false, identifier = 7): TouchLike {
  return {
    timeStamp,
    cancelable: true,
    touches: ended ? [] : [{ identifier, clientX: x, clientY: y }],
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
  }
}

function makeSurface() {
  const listeners = new Map<string, Listener>()
  const capture = (options?: ListenerOptions) => typeof options === 'boolean' ? options : !!options?.capture
  return {
    listeners,
    addEventListener(type: string, fn: (ev: unknown) => void, options?: ListenerOptions) {
      assert.equal(listeners.has(type), false, `${type} must not be registered twice`)
      listeners.set(type, { fn, capture: capture(options), passive: typeof options === 'object' && !!options.passive })
    },
    removeEventListener(type: string, fn: (ev: unknown) => void, options?: ListenerOptions) {
      const entry = listeners.get(type)
      if (entry?.fn === fn && entry.capture === capture(options)) listeners.delete(type)
    },
  }
}

type Dimensions = {
  scrollHeight: number
  clientHeight: number
  scrollWidth: number
  clientWidth: number
  screenHeight: number
}
type TermStub = {
  rows: number
  modes?: { mouseTrackingMode: string }
  buffer?: { active: { type: string; viewportY: number; baseY: number } }
  scrollLines?: (lines: number) => void
}

function makeFixture(t: TestContext, dimensions: Partial<Dimensions> = {}, term: TermStub = {
  rows: 20, modes: { mouseTrackingMode: 'vt200' },
}) {
  const size = { scrollHeight: 300, clientHeight: 300, scrollWidth: 300, clientWidth: 300, screenHeight: 280, ...dimensions }
  const wheels: SyntheticWheel[] = []
  const screen = { offsetHeight: size.screenHeight }
  const xterm = { dispatchEvent: (event: SyntheticWheel) => { wheels.push(event); return true } }
  const host = {
    ...makeSurface(),
    ...size,
    scrollTop: 0,
    scrollLeft: 0,
    querySelector(selector: string) {
      if (selector === '.xterm') return xterm
      if (selector === '.xterm-screen') return screen
      return null
    },
  }
  const layer = makeSurface()
  let now = 0
  let nextFrame = 0
  const frames = new Map<number, (time: number) => void>()
  const guard = {
    owners: new Set<object>(),
    get count() { return this.owners.size },
    begins: 0,
    ends: 0,
    touches: 0,
    begin(owner: object) {
      assert.ok(owner && typeof owner === 'object', 'each pane supplies an ownership token')
      this.owners.add(owner); this.begins++
    },
    end(owner: object) {
      assert.ok(this.owners.delete(owner), 'a gesture cannot release another owner’s guard')
      this.ends++
    },
    touch(owner: object) {
      assert.ok(this.owners.has(owner), 'momentum refreshes its own guard')
      this.touches++
    },
  }
  const bindTouchScroll = Function('gestureGuard', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', `
    class WheelEvent {
      constructor(type, init) { Object.assign(this, init); this.type = type }
      static DOM_DELTA_LINE = 1
    }
    ${functionSource('bindTouchScroll')}
    return bindTouchScroll
  `)(guard, (callback: (time: number) => void) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }, (id: number) => frames.delete(id), { now: () => now }) as (rec: unknown) => () => void
  let taps = 0
  const rec = { termHost: host, touchLayer: layer, term, vPinned: true, panTop: 0, panLeft: 0, onTap: () => { taps++ } }
  const dispose = bindTouchScroll(rec)
  t.after(() => {
    dispose()
    assert.equal(guard.count, 0, 'fixture teardown releases its guard')
    assert.equal(frames.size, 0, 'fixture teardown cancels every animation')
    assert.equal(host.listeners.size, 0, 'host listeners are removed')
    assert.equal(layer.listeners.size, 0, 'touch-layer listeners are removed')
  })
  return {
    host, layer, wheels, rec, guard, frames, dispose,
    get taps() { return taps },
    fire(type: string, event: TouchLike, surface = host.listeners) {
      now = event.timeStamp
      const listener = surface.get(type)
      assert.ok(listener, `missing ${type} listener`)
      listener.fn(event)
    },
    frame(ms = 16) {
      now += ms
      const current = [...frames.values()]
      frames.clear()
      for (const callback of current) callback(now)
    },
  }
}

function normalTerm(viewportY = 50, baseY = 100, rows = 20) {
  const calls: number[] = []
  const active = { type: 'normal', viewportY, baseY }
  const term: TermStub = {
    rows,
    modes: { mouseTrackingMode: 'none' },
    buffer: { active },
    scrollLines(lines) {
      calls.push(lines)
      active.viewportY = Math.max(0, Math.min(active.baseY, active.viewportY + lines))
    },
  }
  return { term, active, calls }
}

test('mouse-reporting drags preserve every row as an individual wheel report', (t) => {
  const f = makeFixture(t)
  const start = touchEvent(100, 300, 0)
  f.fire('touchstart', start)
  assert.equal(start.stopped, true)
  assert.equal(f.guard.count, 1)

  const first = touchEvent(100, 290, 16)
  f.fire('touchmove', first)
  assert.equal(first.prevented, true)
  assert.equal(first.stopped, true)
  assert.equal(f.wheels.length, 0, 'sub-row accumulation does not wheel yet')

  f.fire('touchmove', touchEvent(100, 260, 32)) // accumulated 40px = 2 rows + 12px
  assert.deepEqual(f.wheels.map(wheel => wheel.deltaY), [1, 1])
  for (const wheel of f.wheels) {
    assert.equal(wheel.deltaMode, 1)
    assert.equal(wheel.clientX, 100)
    assert.equal(wheel.clientY, 260)
    assert.equal(wheel.bubbles, false)
    assert.equal(wheel.cancelable, true)
  }
  f.fire('touchmove', touchEvent(100, 320, 48)) // remainder 12px - 60px = -3 rows - 6px
  assert.deepEqual(f.wheels.map(wheel => wheel.deltaY), [1, 1, -1, -1, -1])
})

test('vertical drags save clipped-grid pan before wheeling their remainder', (t) => {
  const f = makeFixture(t, { scrollHeight: 500, screenHeight: 500 }, { rows: 25 })
  f.host.scrollTop = 200
  f.rec.panTop = 200
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 380, 16))
  assert.equal(f.host.scrollTop, 120)
  assert.equal(f.rec.panTop, 120)
  assert.equal(f.rec.vPinned, false)
  assert.equal(f.wheels.length, 0)
  f.fire('touchmove', touchEvent(100, 520, 32))
  assert.equal(f.host.scrollTop, 0)
  assert.equal(f.rec.panTop, 0)
  assert.deepEqual(f.wheels.map(wheel => wheel.deltaY), [-1])
})

test('horizontal drags save and clamp pan without wheeling', (t) => {
  const f = makeFixture(t, { scrollWidth: 600 })
  f.fire('touchstart', touchEvent(200, 100, 0))
  f.fire('touchmove', touchEvent(150, 100, 16))
  assert.equal(f.host.scrollLeft, 50)
  assert.equal(f.rec.panLeft, 50)
  f.fire('touchmove', touchEvent(400, 100, 32))
  assert.equal(f.host.scrollLeft, 0)
  assert.equal(f.rec.panLeft, 0)
  assert.equal(f.wheels.length, 0)
})

test('capture listeners claim even the first sub-slop move', (t) => {
  const f = makeFixture(t)
  for (const surface of [f.host, f.layer]) {
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      assert.equal(surface.listeners.get(type)?.capture, true, type)
    }
    assert.equal(surface.listeners.get('touchmove')?.passive, false)
    assert.equal(surface.listeners.get('touchend')?.passive, false, 'end can suppress compatibility clicks')
  }
  f.fire('touchstart', touchEvent(100, 100, 0))
  const first = touchEvent(100, 97, 16)
  f.fire('touchmove', first)
  assert.equal(first.prevented, true)
  assert.equal(first.stopped, true)
  assert.equal(f.wheels.length, 0)
})

test('stable touch layer owns the whole gesture independently of xterm rows', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0), f.layer.listeners)
  f.fire('touchmove', touchEvent(100, 260, 16), f.layer.listeners)
  assert.deepEqual(f.wheels.map(wheel => wheel.deltaY), [1, 1])
  assert.equal(f.guard.count, 1)
})

test('normal scrollback uses row-precise scrollLines, never synthetic wheels', (t) => {
  const normal = normalTerm()
  const f = makeFixture(t, {}, normal.term)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 260, 16))
  assert.deepEqual(normal.calls, [2])
  assert.equal(normal.active.viewportY, 52)
  f.fire('touchmove', touchEvent(100, 320, 32))
  assert.deepEqual(normal.calls, [2, -3])
  assert.equal(normal.active.viewportY, 49)
  assert.equal(f.wheels.length, 0)
})

test('returning through history reaches the live screen before panning clipped rows', (t) => {
  const normal = normalTerm(98, 100, 25)
  const f = makeFixture(t, { scrollHeight: 500, screenHeight: 500 }, normal.term)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 240, 16))
  assert.deepEqual(normal.calls, [2])
  assert.equal(normal.active.viewportY, 100)
  assert.equal(f.host.scrollTop, 20, 'only the 20px remainder pans the live grid')
  assert.equal(f.rec.panTop, 20)
  assert.equal(f.wheels.length, 0)
})

test('alternate-buffer drags dispatch unit wheels rather than local scrollLines', (t) => {
  const f = makeFixture(t, {}, {
    rows: 20,
    modes: { mouseTrackingMode: 'none' },
    buffer: { active: { type: 'alternate', viewportY: 0, baseY: 0 } },
    scrollLines() { assert.fail('alternate-buffer scrolling must reach the terminal program') },
  })
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 258, 16))
  assert.deepEqual(f.wheels.map(wheel => wheel.deltaY), [1, 1, 1])
})

test('normal-buffer mouse reporting still dispatches unit wheels', (t) => {
  const f = makeFixture(t, {}, {
    rows: 20,
    modes: { mouseTrackingMode: 'vt200' },
    buffer: { active: { type: 'normal', viewportY: 0, baseY: 0 } },
    scrollLines() { assert.fail('mouse-reporting programs must receive wheel reports') },
  })
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 328, 16))
  assert.deepEqual(f.wheels.map(wheel => wheel.deltaY), [-1, -1])
})

test('only a completed tap calls onTap, never pointer contact or a drag', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 100, 0))
  assert.equal(f.taps, 0)
  const end = touchEvent(100, 100, 16, true)
  f.fire('touchend', end)
  assert.equal(f.taps, 1)
  assert.equal(end.prevented, true)
  assert.equal(end.stopped, true)
  assert.equal(f.guard.count, 0)
  f.fire('touchstart', touchEvent(100, 300, 32))
  f.fire('touchmove', touchEvent(100, 260, 48))
  f.fire('touchend', touchEvent(100, 260, 160, true))
  assert.equal(f.taps, 1)
})

for (const abortEvent of ['touchstart', 'touchmove']) {
  test(`multi-touch ${abortEvent} abort cannot produce a stale fling on partial release`, (t) => {
    const f = makeFixture(t)
    f.fire('touchstart', touchEvent(100, 300, 0))
    f.fire('touchmove', touchEvent(100, 250, 16))
    const before = f.wheels.length
    const multiple = touchEvent(100, 250, 17)
    multiple.touches.push({ identifier: 8, clientX: 150, clientY: 250 })
    f.fire(abortEvent, multiple)
    assert.equal(f.guard.count, 0)
    f.fire('touchend', touchEvent(100, 250, 18)) // one finger remains
    f.fire('touchmove', touchEvent(100, 100, 32))
    f.fire('touchend', touchEvent(100, 100, 48, true))
    assert.equal(f.frames.size, 0)
    assert.equal(f.wheels.length, before)
    assert.equal(f.taps, 0)
    assert.equal(f.guard.begins, 1)
    assert.equal(f.guard.ends, 1)
  })
}

test('a replacement touch identifier cancels instead of inheriting the gesture', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0, false, 7))
  f.fire('touchmove', touchEvent(100, 250, 16, false, 8))
  f.fire('touchend', touchEvent(100, 250, 32, true, 8))
  assert.equal(f.guard.count, 0)
  assert.equal(f.wheels.length, 0)
  assert.equal(f.frames.size, 0)
  assert.equal(f.taps, 0)
})

test('touchcancel clears motion and accumulator before another gesture', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 290, 16)) // 10px partial row
  const cancel = touchEvent(100, 290, 17, true)
  f.fire('touchcancel', cancel)
  assert.equal(cancel.stopped, true)
  f.fire('touchend', touchEvent(100, 290, 18, true))
  assert.equal(f.guard.count, 0)
  assert.equal(f.frames.size, 0)
  f.fire('touchstart', touchEvent(100, 300, 32))
  f.fire('touchmove', touchEvent(100, 290, 48))
  assert.equal(f.wheels.length, 0, 'partial rows do not leak across canceled gestures')
  assert.equal(f.guard.begins, 2)
  assert.equal(f.guard.ends, 1)
})

test('disposal during contact releases ownership and unregisters both surfaces', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 260, 16))
  f.dispose()
  f.dispose()
  assert.equal(f.guard.count, 0)
  assert.equal(f.guard.ends, 1, 'disposal is idempotent')
  assert.equal(f.host.listeners.size, 0)
  assert.equal(f.layer.listeners.size, 0, 'wheel forwarding is disposed too')
  assert.equal(f.frames.size, 0)
})

test('momentum advances under one guard and releases it on completion', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 244, 16))
  f.fire('touchend', touchEvent(100, 244, 32, true))
  const before = f.wheels.length
  assert.equal(f.frames.size, 1)
  assert.equal(f.guard.count, 1)
  for (let i = 0; i < 200 && f.frames.size; i++) f.frame()
  assert.ok(f.wheels.length > before, 'actual animation frames scroll further')
  assert.equal(f.frames.size, 0)
  assert.equal(f.guard.count, 0)
  assert.equal(f.guard.begins, 1)
  assert.equal(f.guard.ends, 1)
})

for (const stop of ['dispose', 'touchcancel']) {
  test(`${stop} halts a queued fling without further scrolling`, (t) => {
    const f = makeFixture(t)
    f.fire('touchstart', touchEvent(100, 300, 0))
    f.fire('touchmove', touchEvent(100, 244, 16))
    f.fire('touchend', touchEvent(100, 244, 32, true))
    assert.equal(f.frames.size, 1)
    const before = f.wheels.length
    if (stop === 'dispose') f.dispose()
    else f.fire('touchcancel', touchEvent(100, 244, 33, true))
    f.frame()
    assert.equal(f.frames.size, 0)
    assert.equal(f.wheels.length, before)
    assert.equal(f.guard.count, 0)
    assert.equal(f.guard.ends, 1)
  })
}

test('a new contact stops old momentum and acquires exactly one fresh guard', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 244, 16))
  f.fire('touchend', touchEvent(100, 244, 32, true))
  assert.equal(f.frames.size, 1)
  f.fire('touchstart', touchEvent(100, 200, 48))
  assert.equal(f.frames.size, 0)
  assert.equal(f.guard.count, 1)
  assert.equal(f.guard.begins, 2)
  assert.equal(f.guard.ends, 1)
  f.fire('touchend', touchEvent(100, 200, 64, true))
  assert.equal(f.guard.count, 0)
  assert.equal(f.guard.ends, 2)
})

test('holding still before release suppresses stale-velocity momentum', (t) => {
  const f = makeFixture(t)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 244, 16))
  f.fire('touchend', touchEvent(100, 244, 200, true))
  assert.equal(f.frames.size, 0)
  assert.equal(f.guard.count, 0)
  assert.equal(f.guard.ends, 1)
  assert.equal(f.taps, 0)
})

test('normal scrollback at its boundary stops momentum rather than holding paint', (t) => {
  const normal = normalTerm(100, 100)
  const f = makeFixture(t, {}, normal.term)
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 244, 16))
  f.fire('touchend', touchEvent(100, 244, 32, true))
  assert.equal(f.frames.size, 1)
  // With boundary debt cleared, the first frame can be smaller than one row.
  // The next full-row attempt must stop, not run an entire inertial tail.
  for (let i = 0; i < 2 && f.frames.size; i++) f.frame()
  assert.equal(f.frames.size, 0)
  assert.equal(f.guard.count, 0)
  assert.equal(normal.active.viewportY, 100)
})

function wheelEvent(deltaX: number, deltaY: number) {
  return {
    deltaX, deltaY, deltaMode: 0, ctrlKey: false,
    clientX: 100, clientY: 200,
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
  }
}

for (const boundary of ['top', 'bottom']) {
  for (const input of ['touch', 'wheel']) {
    test(`${input} reverses immediately after overscrolling the ${boundary} boundary`, (t) => {
      const atBottom = boundary === 'bottom'
      const normal = normalTerm(atBottom ? 100 : 0, 100)
      const f = makeFixture(t, {}, normal.term)
      const outward = atBottom ? 56 : -56 // four 14px rows against the boundary
      if (input === 'touch') {
        f.fire('touchstart', touchEvent(100, 300, 0))
        f.fire('touchmove', touchEvent(100, 300 - outward, 16))
        f.fire('touchmove', touchEvent(100, 300 - outward / 2, 32)) // reverse two rows
      } else {
        const wheel = f.layer.listeners.get('wheel')!
        wheel.fn(wheelEvent(0, outward))
        wheel.fn(wheelEvent(0, -outward / 2))
      }
      assert.deepEqual(normal.calls, atBottom ? [4, -2] : [-4, 2], 'no accumulated outward scroll debt')
      assert.equal(normal.active.viewportY, atBottom ? 98 : 2)
      assert.equal(f.wheels.length, 0)
    })
  }
}

test('sub-row older movement does not repin a normal buffer that is still in history', (t) => {
  const normal = normalTerm(50, 100)
  const f = makeFixture(t, {}, normal.term)
  f.rec.vPinned = false
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 308, 16)) // crosses slop, but not a 14px row
  assert.deepEqual(normal.calls, [])
  assert.equal(normal.active.viewportY, 50)
  assert.equal(f.rec.vPinned, false, 'a later keyboard resize must not jump to the bottom crop')
})

test('horizontal wheel panning never repins historical scrollback', (t) => {
  const normal = normalTerm(50, 100)
  const f = makeFixture(t, { scrollWidth: 600 }, normal.term)
  f.rec.vPinned = false
  const wheel = wheelEvent(35, 0)
  f.layer.listeners.get('wheel')!.fn(wheel)
  assert.equal(wheel.prevented, true)
  assert.equal(wheel.stopped, true)
  assert.equal(f.host.scrollLeft, 35)
  assert.equal(f.rec.panLeft, 35)
  assert.equal(normal.active.viewportY, 50)
  assert.deepEqual(normal.calls, [])
  assert.equal(f.rec.vPinned, false)
})

test('reaching live scrollback bottom restores pinning when no grid rows are clipped', (t) => {
  const normal = normalTerm(98, 100)
  const f = makeFixture(t, {}, normal.term)
  f.rec.vPinned = false
  f.fire('touchstart', touchEvent(100, 300, 0))
  f.fire('touchmove', touchEvent(100, 272, 16))
  assert.equal(normal.active.viewportY, 100)
  assert.equal(f.rec.vPinned, true)
})
