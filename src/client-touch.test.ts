import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

/**
 * Behavioral tests for the pane touch-gesture owner. These drive the real
 * bindTouchScroll implementation with synthetic touch sequences and assert
 * what actually scrolls — the regression they guard against is a drag that
 * "moves a few pixels at a time" or nothing at all:
 *
 * - Panes whose programs enable mouse reporting (agent CLIs, TUIs) must
 *   still scroll: the old handler aborted for them and xterm's built-in
 *   touch path is dead in that state too.
 * - preventDefault must land on the FIRST touchmove, before slop maths;
 *   an unprevented first move lets iOS commit a visual-viewport pan and
 *   every later event becomes non-cancelable.
 * - Listeners must be capture-phase and stop propagation, keeping xterm's
 *   own competing touch handlers away from the gesture.
 */

const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function functionSource(name: string): string {
  const match = clientSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`))
  assert.ok(match, `missing ${name}`)
  return match[0]
}

type Listener = { fn: (ev: unknown) => void; capture: boolean; passive: boolean }

type SyntheticWheel = {
  type: string
  deltaY: number
  deltaMode: number
  clientX: number
  clientY: number
  bubbles: boolean
}

function makeHost(opts: {
  scrollHeight: number
  clientHeight: number
  scrollWidth: number
  clientWidth: number
  screenHeight: number
}) {
  const listeners = new Map<string, Listener>()
  const wheels: SyntheticWheel[] = []
  const xtermEl = { dispatchEvent: (ev: SyntheticWheel) => { wheels.push(ev); return true } }
  const screenEl = { offsetHeight: opts.screenHeight }
  const host = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: opts.scrollHeight,
    clientHeight: opts.clientHeight,
    scrollWidth: opts.scrollWidth,
    clientWidth: opts.clientWidth,
    addEventListener(type: string, fn: (ev: unknown) => void, options?: { capture?: boolean; passive?: boolean }) {
      listeners.set(type, { fn, capture: !!options?.capture, passive: !!options?.passive })
    },
    querySelector(selector: string) {
      if (selector === '.xterm') return xtermEl
      if (selector === '.xterm-screen') return screenEl
      return null
    },
  }
  return { host, listeners, wheels }
}

type TouchLike = {
  timeStamp: number
  cancelable: boolean
  touches: Array<{ clientX: number; clientY: number }>
  prevented: boolean
  stopped: boolean
  preventDefault(): void
  stopPropagation(): void
}

function touchEvent(x: number, y: number, timeStamp: number, ended = false): TouchLike {
  return {
    timeStamp,
    cancelable: true,
    touches: ended ? [] : [{ clientX: x, clientY: y }],
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
  }
}

const bindTouchScroll = Function(`
  const gestureGuard = { begin() {}, end() {}, touch() {} }
  class WheelEvent {
    constructor(type, init) { Object.assign(this, init); this.type = type }
    static DOM_DELTA_LINE = 1
  }
  const requestAnimationFrame = () => 1
  const cancelAnimationFrame = () => {}
  const performance = { now: () => 0 }
  ${functionSource('bindTouchScroll')}
  return bindTouchScroll
`)() as (rec: { termHost: unknown; term: unknown; vPinned?: boolean }) => void

test('drags scroll panes with mouse reporting via synthetic wheels', () => {
  // No clipped rows: the entire drag budget must become wheel events even
  // though the program enabled mouse tracking (the old code aborted here).
  const { host, listeners, wheels } = makeHost({
    scrollHeight: 300, clientHeight: 300, scrollWidth: 300, clientWidth: 300,
    screenHeight: 280, // 20 rows -> 14px per row
  })
  const rec = { termHost: host, term: { rows: 20, modes: { mouseTrackingMode: 'vt200' } }, vPinned: true }
  bindTouchScroll(rec)

  const start = touchEvent(100, 300, 0)
  listeners.get('touchstart')!.fn(start)
  assert.equal(start.stopped, true, 'touchstart fences xterm handlers')

  const first = touchEvent(100, 290, 16)
  listeners.get('touchmove')!.fn(first)
  assert.equal(first.prevented, true, 'first touchmove is claimed before slop maths')
  assert.equal(first.stopped, true)
  assert.equal(wheels.length, 0, 'sub-row accumulation does not wheel yet')

  listeners.get('touchmove')!.fn(touchEvent(100, 260, 32)) // accumulated 40px ≈ 2 rows
  assert.equal(wheels.length, 1)
  assert.equal(wheels[0].deltaY, 2, 'finger up scrolls towards newer content')
  assert.equal(wheels[0].deltaMode, 1, 'row-quantized line-mode wheels')
  assert.equal(wheels[0].clientX, 100)
  assert.equal(wheels[0].clientY, 260, 'wheel carries touch coords for mouse reports')

  listeners.get('touchmove')!.fn(touchEvent(100, 320, 48)) // reverse: -60px
  assert.equal(wheels.length, 2)
  assert.equal(wheels[1].deltaY, -3, 'finger down scrolls towards older content')

  const end = touchEvent(0, 0, 64, true)
  listeners.get('touchend')!.fn(end)
  assert.equal(end.stopped, true)
})

test('vertical drags pan clipped grid rows before wheeling', () => {
  const { host, listeners, wheels } = makeHost({
    scrollHeight: 500, clientHeight: 300, scrollWidth: 300, clientWidth: 300,
    screenHeight: 500, // 25 rows -> 20px per row
  })
  host.scrollTop = 200 // pinned to the prompt rows at the bottom
  const rec = { termHost: host, term: { rows: 25 }, vPinned: true }
  bindTouchScroll(rec)

  listeners.get('touchstart')!.fn(touchEvent(100, 300, 0))
  listeners.get('touchmove')!.fn(touchEvent(100, 380, 16)) // drag down 80px
  assert.equal(host.scrollTop, 120, 'clipped rows consume the budget first')
  assert.equal(wheels.length, 0)
  assert.equal(rec.vPinned, false, 'panning away unpins the bottom rows')

  listeners.get('touchmove')!.fn(touchEvent(100, 520, 32)) // 140px more
  assert.equal(host.scrollTop, 0, 'row panning stops at the top edge')
  assert.equal(wheels.length, 1)
  assert.equal(wheels[0].deltaY, -1, 'the remainder continues into a wheel')
})

test('horizontal drags pan a grid wider than its box', () => {
  const { host, listeners, wheels } = makeHost({
    scrollHeight: 300, clientHeight: 300, scrollWidth: 600, clientWidth: 300,
    screenHeight: 280,
  })
  const rec = { termHost: host, term: { rows: 20 }, vPinned: true }
  bindTouchScroll(rec)

  listeners.get('touchstart')!.fn(touchEvent(200, 100, 0))
  listeners.get('touchmove')!.fn(touchEvent(150, 100, 16)) // horizontal-led gesture
  assert.equal(host.scrollLeft, 50, 'content follows the finger horizontally')
  listeners.get('touchmove')!.fn(touchEvent(400, 100, 32)) // reverse past the left edge
  assert.equal(host.scrollLeft, 0, 'clamped at the left edge')
  assert.equal(wheels.length, 0, 'horizontal gestures never wheel')
})

test('gesture listeners are capture-phase so xterm cannot preempt them', () => {
  const { host, listeners } = makeHost({
    scrollHeight: 300, clientHeight: 300, scrollWidth: 300, clientWidth: 300,
    screenHeight: 280,
  })
  bindTouchScroll({ termHost: host, term: { rows: 20 }, vPinned: true })
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert.equal(listeners.get(type)?.capture, true, `${type} is capture-phase`)
  }
  assert.equal(listeners.get('touchmove')?.passive, false, 'touchmove can preventDefault')
})

test('the stable touch layer receives the same gesture handlers', () => {
  // Touch events are target-locked to the element under the finger at
  // touchstart; xterm's DOM renderer replaces its row elements on every
  // render, so on a streaming pane the touched span detaches and the rest
  // of the gesture stops propagating — every drag died after ~one move.
  // The transparent layer above the terminal is never re-rendered, so the
  // full gesture must arrive through IT.
  const { host, wheels } = makeHost({
    scrollHeight: 300, clientHeight: 300, scrollWidth: 300, clientWidth: 300,
    screenHeight: 280, // 20 rows -> 14px per row
  })
  const layerListeners = new Map<string, Listener>()
  const layer = {
    addEventListener(type: string, fn: (ev: unknown) => void, options?: { capture?: boolean; passive?: boolean }) {
      layerListeners.set(type, { fn, capture: !!options?.capture, passive: !!options?.passive })
    },
  }
  const rec = { termHost: host, touchLayer: layer, term: { rows: 20 }, vPinned: true }
  bindTouchScroll(rec)
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert.ok(layerListeners.get(type), `${type} bound on the touch layer`)
  }
  // A drag delivered exclusively through the layer scrolls the pane.
  layerListeners.get('touchstart')!.fn(touchEvent(100, 300, 0))
  layerListeners.get('touchmove')!.fn(touchEvent(100, 260, 16))
  assert.equal(wheels.length, 1)
  assert.equal(wheels[0].deltaY, 2)
})
