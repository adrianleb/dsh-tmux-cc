import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

type Guard = {
  owners: Set<object>
  since: number
  pending: boolean
  onEnd: (() => void) | null
  timer: number
  begin(owner: object): void
  touch(owner: object): void
  end(owner: object): void
  holding(): boolean
}

function makeGuard() {
  const source = clientSource.match(/const gestureGuard = (\{[\s\S]*?\n    \})/)
  assert.ok(source, 'missing production gesture guard')
  let now = 0
  let nextTimer = 0
  let flushes = 0
  const timers = new Map<number, { at: number; callback: () => void }>()
  const guard = Function('setTimeout', 'clearTimeout', 'Date', `return (${source[1]})`)(
    (callback: () => void, delay: number) => {
      const id = ++nextTimer
      timers.set(id, { at: now + delay, callback })
      return id
    },
    (id: number) => { timers.delete(id) },
    { now: () => now },
  ) as Guard
  guard.onEnd = () => { flushes++ }
  return {
    guard, timers,
    get now() { return now },
    get flushes() { return flushes },
    advance(ms: number) {
      const target = now + ms
      while (timers.size) {
        const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        if (timer.at > target) break
        now = timer.at
        timers.delete(id)
        timer.callback()
      }
      now = target
    },
  }
}

test('paint guard holds until its last distinct owner releases', () => {
  const f = makeGuard()
  const first = {}, second = {}, unrelated = {}
  assert.equal(f.guard.holding(), false)
  f.guard.begin(first)
  f.guard.begin(first)
  f.guard.begin(second)
  assert.equal(f.guard.owners.size, 2, 'the same token cannot acquire duplicate ownership')
  assert.equal(f.timers.size, 1, 'renewal replaces, rather than accumulates, expiry timers')
  f.guard.pending = true
  f.guard.end(unrelated)
  f.guard.end(first)
  assert.equal(f.guard.holding(), true)
  assert.equal(f.flushes, 0)
  f.guard.end(second)
  assert.equal(f.guard.holding(), false)
  assert.equal(f.guard.pending, false)
  assert.equal(f.flushes, 1)
  assert.equal(f.timers.size, 0)
  f.guard.end(second)
  f.advance(2000)
  assert.equal(f.flushes, 1, 'duplicate release and canceled expiry cannot flush twice')
})

test('lost touchend expires and flushes without any further user or redraw event', () => {
  const f = makeGuard()
  f.guard.begin({})
  f.guard.pending = true
  f.advance(1499)
  assert.equal(f.guard.holding(), true)
  assert.equal(f.flushes, 0)
  f.advance(1)
  assert.equal(f.guard.holding(), false)
  assert.equal(f.guard.owners.size, 0)
  assert.equal(f.guard.pending, false)
  assert.equal(f.flushes, 1)
  assert.equal(f.timers.size, 0)
  f.advance(3000)
  assert.equal(f.flushes, 1)
})

test('motion renews the actual expiry deadline', () => {
  const f = makeGuard()
  const owner = {}
  f.guard.begin(owner)
  f.advance(1000)
  f.guard.touch(owner)
  f.advance(500)
  assert.equal(f.guard.holding(), true, 'the original deadline was canceled')
  assert.equal(f.flushes, 0)
  f.advance(999)
  assert.equal(f.guard.holding(), true)
  f.advance(1)
  assert.equal(f.guard.holding(), false)
  assert.equal(f.flushes, 1)
})

test('resumed motion reacquires its ownership after an idle expiry', () => {
  const f = makeGuard()
  const owner = {}
  f.guard.begin(owner)
  f.advance(1500)
  assert.equal(f.guard.holding(), false)
  f.guard.touch(owner)
  assert.equal(f.guard.holding(), true)
  assert.equal(f.guard.owners.has(owner), true)
  assert.equal(f.timers.size, 1)
  f.guard.pending = true
  f.guard.end(owner)
  assert.equal(f.guard.holding(), false)
  assert.equal(f.flushes, 2, 'expiry and the resumed gesture each flush once')
  assert.equal(f.timers.size, 0)
})

test('an expired owner cannot release or cancel the timer of a newer owner', () => {
  const f = makeGuard()
  const expired = {}, current = {}
  f.guard.begin(expired)
  f.advance(1500)
  f.guard.begin(current)
  f.guard.pending = true
  f.guard.end(expired)
  assert.equal(f.guard.owners.has(current), true)
  assert.equal(f.guard.holding(), true)
  assert.equal(f.guard.pending, true)
  assert.equal(f.flushes, 1, 'stale release does not flush another gesture')
  assert.equal(f.timers.size, 1)
  f.advance(1500)
  assert.equal(f.guard.holding(), false)
  assert.equal(f.flushes, 2, 'the current owner still has a working expiry timer')
})

// Integration with bindTouchScroll ensures real panes pass distinct tokens to
// begin/touch/end; testing the guard object alone would miss an omitted token.
function makePane(f: ReturnType<typeof makeGuard>) {
  const source = clientSource.match(/function bindTouchScroll\([^)]*\) \{[\s\S]*?\n    \}/)
  assert.ok(source, 'missing production touch binding')
  const listeners = new Map<string, (event: unknown) => void>()
  const frames = new Map<number, (time: number) => void>()
  let nextFrame = 0
  const host = {
    scrollLeft: 0, scrollTop: 0,
    scrollWidth: 600, clientWidth: 300, scrollHeight: 300, clientHeight: 300,
    querySelector: () => null,
    addEventListener(type: string, listener: (event: unknown) => void) { listeners.set(type, listener) },
    removeEventListener(type: string, listener: (event: unknown) => void) {
      if (listeners.get(type) === listener) listeners.delete(type)
    },
  }
  const bind = Function('gestureGuard', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', `
    ${source[0]}
    return bindTouchScroll
  `)(f.guard, (callback: (time: number) => void) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }, (id: number) => { frames.delete(id) }, { now: () => f.now }) as (rec: unknown) => () => void
  const dispose = bind({ termHost: host, term: { rows: 20 }, panLeft: 0, panTop: 0 })
  return {
    host, frames, dispose,
    fire(type: string, x: number) {
      const listener = listeners.get(type)
      assert.ok(listener)
      listener({
        timeStamp: f.now,
        touches: type === 'touchend' ? [] : [{ identifier: 1, clientX: x, clientY: 100 }],
        cancelable: true, preventDefault() {}, stopPropagation() {},
      })
    },
  }
}

test('a real drag resuming after expiry reacquires and releases the same pane token', () => {
  const f = makeGuard()
  const pane = makePane(f)
  try {
    pane.fire('touchstart', 100)
    const owner = [...f.guard.owners][0]
    assert.ok(owner && typeof owner === 'object')
    f.advance(1500)
    assert.equal(f.guard.holding(), false)
    pane.fire('touchmove', 50)
    assert.equal(pane.host.scrollLeft, 50)
    assert.equal(f.guard.holding(), true)
    assert.equal(f.guard.owners.has(owner), true)
    f.guard.pending = true
    f.advance(200) // stationary release must not fling
    pane.fire('touchend', 50)
    assert.equal(f.guard.holding(), false)
    assert.equal(f.flushes, 2)
    assert.equal(pane.frames.size, 0)
  } finally {
    pane.dispose()
  }
  assert.equal(f.timers.size, 0)
})

test('disposing an expired pane cannot steal a newer pane’s active paint guard', () => {
  const f = makeGuard()
  const expired = makePane(f)
  const current = makePane(f)
  try {
    expired.fire('touchstart', 100)
    const oldOwner = [...f.guard.owners][0]
    f.advance(1500)
    current.fire('touchstart', 100)
    const newOwner = [...f.guard.owners][0]
    assert.notEqual(oldOwner, newOwner)
    f.guard.pending = true
    expired.dispose()
    assert.equal(f.guard.holding(), true)
    assert.equal(f.guard.owners.has(newOwner), true)
    assert.equal(f.guard.pending, true)
    assert.equal(f.flushes, 1)
    assert.equal(f.timers.size, 1)
    current.fire('touchend', 100)
    assert.equal(f.guard.holding(), false)
    assert.equal(f.flushes, 2)
  } finally {
    expired.dispose()
    current.dispose()
  }
  assert.equal(f.timers.size, 0)
})
