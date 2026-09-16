import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const client = readFileSync(new URL('../../lib/client.js', import.meta.url), 'utf8')
const xterm = readFileSync(require.resolve('@xterm/xterm/lib/xterm.js'), 'utf8')
const xtermCss = readFileSync(require.resolve('@xterm/xterm/css/xterm.css'), 'utf8')

// Entirely synthetic data and transport. No commands reach a user's tmux.
async function boot(page: Page, mobile = true, confirmKill = false) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.route('http://tmux.test/**', route => route.fulfill({
    contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"><div><main data-slot="conversation"></main></div></div>',
  }))
  await page.goto('http://tmux.test/')
  await page.addStyleTag({ content: xtermCss })
  await page.addScriptTag({ content: xterm })
  await page.evaluate(({ confirmKill }) => {
    const w = window as any
    w.sent = []
    w.terms = []
    const Terminal = w.Terminal
    w.Terminal = class extends Terminal { constructor(opts: any) { super(opts); w.terms.push(this) } }
    w.snapshot = {
      attached: true, session: 'ux-fixture', cols: 160, rows: 80, sizeMode: 'mirror',
      sessions: [{ name: 'ux-fixture' }], windows: [{ id: '@1', name: 'fixture', active: true }],
      panes: [
        { id: '%1', left: 0, top: 0, width: 79, height: 80, active: true, title: 'Alpha' },
        { id: '%2', left: 80, top: 0, width: 80, height: 80, active: false, title: 'Beta' },
      ],
    }
    class Socket {
      readyState = 1
      onopen?: () => void
      onmessage?: (event: any) => void
      constructor() { w.socket = this; setTimeout(() => this.onopen?.(), 0) }
      send(data: string) {
        const msg = JSON.parse(data); w.sent.push(msg)
        if (msg.type === 'resize-pane') w.onResize?.(msg)
        if (msg.type === 'hello') this.onmessage?.({ data: JSON.stringify({ type: 'snapshot', snapshot: w.snapshot }) })
        if (msg.type === 'capture') for (const pane of w.snapshot.panes) {
          if (!msg.pane || msg.pane === pane.id) this.onmessage?.({ data: JSON.stringify({ type: 'history', pane: pane.id, data: Array.from({ length: 100 }, (_, n) => `fixture row ${n}\r\n`).join('') }) })
        }
      }
      close() { this.readyState = 3 }
    }
    w.WebSocket = Socket
    localStorage.setItem('dsh-tmux-cc:dock', JSON.stringify({ prefs: { open: true, confirmKill, size: 500, mobileFontFloor: 12 } }))
    w.__ModuleLoader__ = { load({ factory }: any) {
      factory(() => ({ createElement() {} })).apply({
        settingsScope: { bind: () => ({}) },
        effect: (fn: any) => fn(),
        slots: { inject() {} },
      })
    } }
  }, { confirmKill })
  await page.addScriptTag({ content: client })
  await expect(page.locator('.xterm')).toHaveCount(2)
  await expect.poll(() => page.evaluate(() => (window as any).terms.every((t: any) => t.rows === 80 && t.buffer.active.baseY > 0))).toBe(true)
  await frames(page)
}
async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
}
async function messages(page: Page, type: string) {
  return page.evaluate(type => (window as any).sent.filter((m: any) => m.type === type), type)
}
async function gesture(page: Page, pane: number, dx: number, dy: number, end = true) {
  // TouchEvent support differs between desktop WebKit and Chromium. These
  // events exercise production listeners; a separate CDP test uses trusted touch.
  await page.locator('[data-tmux-cc-touch]').nth(pane).evaluate((node, { dx, dy, end }) => {
    const r = node.getBoundingClientRect()
    const x = r.x + r.width / 2, y = r.y + r.height / 2
    const fire = (type: string, xx: number, yy: number, ended: boolean, time: number) => {
      const ev = new Event(type, { bubbles: true, cancelable: true })
      const point = { identifier: 1, clientX: xx, clientY: yy }
      Object.defineProperties(ev, { touches: { value: ended ? [] : [point] }, changedTouches: { value: [point] }, timeStamp: { value: time } })
      node.dispatchEvent(ev)
    }
    fire('touchstart', x, y, false, 1000)
    fire('touchmove', x + dx, y + dy, false, 1020)
    if (end) fire('touchend', x + dx, y + dy, true, 1200) // stationary release, no fling
  }, { dx, dy, end })
}
async function hostState(page: Page, index = 0) {
  return page.locator('.xterm').nth(index).evaluate(node => {
    const host = node.parentElement!
    return { left: host.scrollLeft, top: host.scrollTop, maxTop: host.scrollHeight - host.clientHeight, width: host.clientWidth, height: host.clientHeight }
  })
}

async function resizeGrid(page: Page, mobile = true) {
  await boot(page, mobile)
  await page.evaluate(() => {
    const w = window as any
    w.snapshot.panes = [
      { id: '%1', left: 0, top: 0, width: 79, height: 39, active: true, title: 'Alpha' },
      { id: '%2', left: 80, top: 0, width: 80, height: 39, active: false, title: 'Beta' },
      { id: '%3', left: 0, top: 40, width: 79, height: 40, active: false, title: 'Gamma' },
      { id: '%4', left: 80, top: 40, width: 80, height: 40, active: false, title: 'Delta' },
    ]
    const publish = () => w.socket.onmessage({ data: JSON.stringify({ type: 'snapshot', snapshot: w.snapshot }) })
    // Model a host layout reply during each move. The production divider must
    // keep pointer ownership as panes and terminal grids change underneath it.
    w.onResize = (msg: any) => {
      const [a, b, c, d] = w.snapshot.panes
      if (msg.width !== undefined) {
        a.width = c.width = Math.max(4, Math.min(150, msg.width))
        b.left = d.left = a.width + 1
        b.width = d.width = 160 - b.left
      }
      if (msg.height !== undefined) {
        a.height = b.height = Math.max(4, Math.min(70, msg.height))
        c.top = d.top = a.height + 1
        c.height = d.height = 80 - c.top
      }
      publish()
    }
    publish()
  })
  await expect(page.locator('.xterm')).toHaveCount(4)
  await frames(page)
}

for (const axis of ['x', 'y'] as const) {
  test(`mobile touch divider resizes ${axis === 'x' ? 'width' : 'height'} across snapshots and releases cleanly`, async ({ page }) => {
    await resizeGrid(page)
    await page.locator('[data-tmux-cc-kbd]').click()
    await expect(page.locator('.xterm-helper-textarea').first()).toBeFocused()
    await frames(page)
    const dir = axis === 'x' ? 'v' : 'h'
    const sash = page.locator(`[data-tmux-cc-sash][data-dir="${dir}"]`).first()
    await expect(sash).toBeVisible()
    const rect = (await sash.boundingBox())!
    expect(axis === 'x' ? rect.width : rect.height).toBeGreaterThanOrEqual(24)
    await expect(sash).toHaveCSS('touch-action', 'none')
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-tmux-cc-sash]'), point)).toBe(true)
    const event = { pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: point.x, clientY: point.y }
    await sash.dispatchEvent('pointerdown', event)
    await expect(sash).toHaveAttribute('data-active', '1')
    const before = await page.locator('[data-tmux-cc-pane]').first().boundingBox()
    for (const delta of [20, 40, 60]) {
      await page.evaluate(({ event, axis, delta }) => window.dispatchEvent(new PointerEvent('pointermove', {
        ...event, clientX: event.clientX + (axis === 'x' ? delta : 0), clientY: event.clientY + (axis === 'y' ? delta : 0),
      })), { event, axis, delta })
      await frames(page)
      await expect(sash).toHaveAttribute('data-active', '1')
    }
    const resizes = await messages(page, 'resize-pane')
    expect(resizes.length).toBeGreaterThanOrEqual(3)
    expect(resizes.every((m: any) => m.pane === '%1' && (axis === 'x' ? m.width > 79 && m.height === undefined : m.height > 39 && m.width === undefined))).toBe(true)
    const after = (await page.locator('[data-tmux-cc-pane]').first().boundingBox())!
    expect(axis === 'x' ? after.width : after.height).toBeGreaterThan(axis === 'x' ? before!.width : before!.height)
    await page.evaluate(event => window.dispatchEvent(new PointerEvent('pointercancel', event)), event)
    await expect(sash).not.toHaveAttribute('data-active')
    await expect(page.locator('body')).not.toHaveAttribute('data-dsh-tmux-dragging')
    await page.evaluate(event => window.dispatchEvent(new PointerEvent('pointermove', { ...event, clientX: event.clientX + 120, clientY: event.clientY + 120 })), event)
    expect(await messages(page, 'resize-pane')).toEqual(resizes)
    await expect(page.locator('.xterm-helper-textarea').first()).toBeFocused()
    expect(await messages(page, 'select')).toHaveLength(0)
    expect(await messages(page, 'input')).toHaveLength(0)
    expect(await messages(page, 'swap')).toHaveLength(0)
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({ x: 0, y: 0 })
    expect((await messages(page, 'resize')).some((m: any) => m.cols !== undefined || m.rows !== undefined)).toBe(false)
  })
}

test('trusted touch can resize pane dividers in both directions repeatedly', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP trusted touch input is Chromium-only')
  await resizeGrid(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  for (const axis of ['x', 'y', 'x', 'y'] as const) {
    const sash = page.locator(`[data-tmux-cc-sash][data-dir="${axis === 'x' ? 'v' : 'h'}"]`).first()
    const r = (await sash.boundingBox())!
    const x = r.x + r.width / 2, y = r.y + r.height / 2
    const count = (await messages(page, 'resize-pane')).length
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await expect(sash).toHaveAttribute('data-active', '1')
    for (let n = 1; n <= 4; n++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (axis === 'x' ? n * 10 : 0), y: y + (axis === 'y' ? n * 10 : 0) }] })
      await frames(page)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('body')).not.toHaveAttribute('data-dsh-tmux-dragging')
    await expect(sash).not.toHaveAttribute('data-active')
    const changes = (await messages(page, 'resize-pane')).slice(count)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes.every((m: any) => axis === 'x' ? m.width !== undefined : m.height !== undefined)).toBe(true)
  }
  expect(await messages(page, 'select')).toHaveLength(0)
  expect(await messages(page, 'input')).toHaveLength(0)
  expect(await messages(page, 'swap')).toHaveLength(0)
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('TEXTAREA')
  // Returning to the terminal body still pans; the divider does not own the pane.
  const count = (await messages(page, 'resize-pane')).length
  const before = await hostState(page)
  await gesture(page, 0, -50, 0)
  expect((await hostState(page)).left).toBeGreaterThan(before.left)
  expect((await messages(page, 'resize-pane')).length).toBe(count)
})

test('desktop Hide closes on the first click, even with terminal focus', async ({ page }) => {
  await boot(page, false)
  await page.locator('.xterm').first().click()
  await page.locator('[data-tmux-cc-close]').click()
  await expect(page.locator('[data-tmux-cc-shell]')).toHaveCount(0)
  expect(await messages(page, 'kill')).toHaveLength(0)
})

test('pane close is one click, excludes focus/zoom, and uses explicit confirmation', async ({ page }) => {
  await boot(page, false, true)
  page.once('dialog', d => d.dismiss())
  await page.locator('[data-tmux-cc-pclose]').nth(1).click()
  expect(await messages(page, 'kill')).toHaveLength(0)
  page.once('dialog', d => d.accept())
  await page.locator('[data-tmux-cc-pclose]').nth(1).click()
  expect(await messages(page, 'kill')).toEqual([{ type: 'kill', pane: '%2' }])
  expect(await messages(page, 'select')).toHaveLength(0)
  expect(await messages(page, 'zoom')).toHaveLength(0)
})

test('mobile pane close stays under the pointer while keyboard focus is active', async ({ page }) => {
  await boot(page)
  await page.locator('[data-tmux-cc-kbd]').click()
  await expect(page.locator('.xterm-helper-textarea').first()).toBeFocused()
  const close = page.locator('[data-tmux-cc-pclose]').nth(1)
  const before = (await close.boundingBox())!
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await frames(page)
  expect(await close.boundingBox()).toEqual(before)
  await expect(page.locator('.xterm-helper-textarea').first()).toBeFocused()
  await page.mouse.up()
  expect(await messages(page, 'kill')).toEqual([{ type: 'kill', pane: '%2' }])
})

test('title drag swaps panes; canceled drag sends no command', async ({ page }) => {
  await boot(page)
  const a = await page.locator('[data-tmux-cc-ptitle]').first().boundingBox()
  const b = await page.locator('[data-tmux-cc-touch]').nth(1).boundingBox()
  await page.mouse.move(a!.x + 35, a!.y + 16)
  await page.mouse.down()
  await page.mouse.move(b!.x + 50, b!.y + 60, { steps: 8 })
  await expect(page.locator('[data-drop-target]')).toHaveCount(1)
  await page.mouse.up()
  expect(await messages(page, 'swap')).toEqual([{ type: 'swap', pane: '%1', target: '%2' }])
  await expect(page.locator('[data-drop-target]')).toHaveCount(0)
  await page.mouse.move(a!.x + 35, a!.y + 16)
  await page.mouse.down()
  await page.mouse.move(b!.x + 50, b!.y + 60)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  expect(await messages(page, 'swap')).toHaveLength(1)
})

test('touch doubletap plus compatibility dblclick zooms once; mouse double-click still works', async ({ page }) => {
  await boot(page)
  const title = page.locator('[data-tmux-cc-ptitle]').first()
  await title.evaluate(node => {
    const r = node.getBoundingClientRect()
    for (let n = 0; n < 2; n++) {
      const options = { bubbles: true, cancelable: true, button: 0, isPrimary: true, pointerType: 'touch', pointerId: 7, clientX: r.x + 30, clientY: r.y + 10 }
      const down = new PointerEvent('pointerdown', options)
      const up = new PointerEvent('pointerup', options)
      Object.defineProperty(up, 'timeStamp', { value: 1000 + n * 200 })
      node.dispatchEvent(down)
      node.dispatchEvent(up)
    }
    // WebKit need not expose Chromium's sourceCapabilities field.
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
  })
  expect(await messages(page, 'zoom')).toEqual([{ type: 'zoom', pane: '%1' }])
  await title.dblclick({ position: { x: 30, y: 10 } })
  expect(await messages(page, 'zoom')).toHaveLength(2)
})

test('mobile crop pans both directions without opening keyboard', async ({ page }) => {
  await boot(page)
  const before = await hostState(page)
  await gesture(page, 0, -70, 0)
  expect((await hostState(page)).left).toBeCloseTo(before.left + 70, 0)
  await gesture(page, 0, 0, 65)
  expect((await hostState(page)).top).toBeCloseTo(Math.max(0, before.top - 65), 0)
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('TEXTAREA')
  expect(await messages(page, 'resize')).not.toContainEqual(expect.objectContaining({ cols: expect.any(Number) }))
})

test('keyboard resize preserves font and intentional pan; cross-pane drag does not refocus', async ({ page }) => {
  await boot(page)
  await gesture(page, 0, -70, 0)
  await gesture(page, 0, 0, 65)
  const before = await hostState(page)
  const font = await page.evaluate(() => (window as any).terms[0].options.fontSize)
  await page.locator('[data-tmux-cc-kbd]').click()
  await expect(page.locator('.xterm-helper-textarea').first()).toBeFocused()
  await page.setViewportSize({ width: 390, height: 480 })
  await frames(page)
  const during = await hostState(page)
  expect(during.left).toBeCloseTo(before.left, 0)
  expect(during.top).toBeCloseTo(before.top, 0)
  expect(await page.evaluate(() => (window as any).terms[0].options.fontSize)).toBe(font)
  await gesture(page, 1, 0, 60)
  await expect(page.locator('.xterm-helper-textarea').first()).toBeFocused()
  await gesture(page, 1, 0, 0)
  await expect(page.locator('.xterm-helper-textarea').nth(1)).toBeFocused()
  await page.locator('[data-tmux-cc-kbd]').click()
  await page.setViewportSize({ width: 390, height: 844 })
  await frames(page)
  expect((await hostState(page)).left).toBeCloseTo(before.left, 0)
  expect((await hostState(page)).top).toBeCloseTo(before.top, 0)
})

test('real xterm scrollback and SGR mouse reports preserve drag distance', async ({ page }) => {
  await boot(page)
  await page.evaluate(async () => {
    for (const term of (window as any).terms) { term.resize(20, 8); await new Promise<void>(resolve => term.write('\x1b[?1000l', resolve)) }
  })
  await frames(page)
  const initial = await page.evaluate(() => (window as any).terms[0].buffer.active.viewportY)
  await gesture(page, 0, 0, 60)
  const current = await page.evaluate(() => (window as any).terms[0].buffer.active.viewportY)
  expect(initial - current).toBeGreaterThanOrEqual(4)
  expect(initial - current).toBeLessThanOrEqual(5)
  await page.evaluate(async () => {
    const term = (window as any).terms[1]
    await new Promise<void>(resolve => term.write('\x1b[?1049h\x1b[?1000h\x1b[?1006h', resolve))
    ;(window as any).sent = []
  })
  await gesture(page, 1, 0, 60)
  const input = await messages(page, 'input')
  expect(input.length).toBeGreaterThanOrEqual(4)
  expect(input.every((m: any) => /^\x1b\[<64;/.test(m.data))).toBe(true)
})

test('Hide cancels a held gesture immediately and releases mobile page lock', async ({ page }) => {
  await boot(page)
  await gesture(page, 0, -60, 0, false)
  await page.locator('[data-tmux-cc-close]').click()
  await expect(page.locator('[data-tmux-cc-shell]')).toHaveCount(0, { timeout: 600 })
  await expect(page.locator('html')).not.toHaveAttribute('data-dsh-tmux-mobile-lock')
  await page.locator('[data-tmux-cc-launcher]').click()
  await expect(page.locator('.xterm')).toHaveCount(2)
})

test('font stepper grows monotonically through the default floor', async ({ page }) => {
  await boot(page)
  await page.locator('[data-tmux-cc-font-down]').click()
  await expect.poll(() => page.evaluate(() => (window as any).terms[0].options.fontSize)).toBe(11)
  await page.locator('[data-tmux-cc-font-up]').click()
  await expect.poll(() => page.evaluate(() => (window as any).terms[0].options.fontSize)).toBe(12)
  await page.locator('[data-tmux-cc-font-up]').click()
  await expect.poll(() => page.evaluate(() => (window as any).terms[0].options.fontSize)).toBe(13)
})

test('wheel pixel fragments accumulate and horizontal wheels pan the crop', async ({ page }) => {
  await boot(page)
  await page.evaluate(async () => {
    const term = (window as any).terms[0]
    term.resize(79, 8)
    await new Promise<void>(resolve => term.write('', resolve))
  })
  await frames(page)
  const before = await page.evaluate(() => (window as any).terms[0].buffer.active.viewportY)
  await page.locator('[data-tmux-cc-touch]').first().evaluate(node => {
    for (let i = 0; i < 20; i++) node.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: -2, deltaMode: 0 }))
    node.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaX: 50, deltaMode: 0 }))
  })
  expect(before - await page.evaluate(() => (window as any).terms[0].buffer.active.viewportY)).toBeGreaterThanOrEqual(2)
  expect((await hostState(page)).left).toBe(50)
})

test('alternate-screen gestures emit one arrow per row', async ({ page }) => {
  await boot(page)
  await page.evaluate(async () => {
    const w = window as any, term = w.terms[0]
    term.resize(20, 8)
    await new Promise<void>(resolve => term.write('\x1b[?1049h\x1b[?1000l', resolve))
    w.sent = []
  })
  await frames(page)
  await gesture(page, 0, 0, 60)
  const data = (await messages(page, 'input')).map((m: any) => m.data).join('')
  expect(data).toMatch(/^(\x1b\[A){4,5}$/)
})

test('visual viewport offset follows Safari-style panning without changing the crop', async ({ page }) => {
  await boot(page)
  await gesture(page, 0, -70, 0)
  await gesture(page, 0, 0, 60)
  const before = await hostState(page)
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 85 })
    window.visualViewport!.dispatchEvent(new Event('scroll'))
  })
  await expect(page.locator('[data-tmux-cc-shell]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 85)')
  expect(await hostState(page)).toEqual(before)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('a lost touchend cannot indefinitely defer snapshot painting', async ({ page }) => {
  await boot(page)
  await page.clock.install()
  await gesture(page, 0, -50, 0, false)
  await page.evaluate(() => {
    const w = window as any
    w.snapshot.panes[0].title = 'Repaint after expiry'
    w.socket.onmessage({ data: JSON.stringify({ type: 'snapshot', snapshot: w.snapshot }) })
  })
  await page.clock.runFor(100)
  await expect(page.locator('[data-tmux-cc-ptitle]').first()).not.toContainText('Repaint after expiry')
  await page.clock.runFor(1600)
  await expect(page.locator('[data-tmux-cc-ptitle]').first()).toContainText('Repaint after expiry')
})

test('Chromium trusted touch pans a streaming pane and scrolls toolbar', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP trusted touch input is Chromium-only')
  await boot(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const r = (await page.locator('[data-tmux-cc-touch]').first().boundingBox())!
  const x = r.x + 150, y = r.y + 100
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let n = 1; n <= 6; n++) {
    await page.evaluate(n => (window as any).terms[0].write(`stream ${n}\r\n`), n)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - n * 15, y }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect((await hostState(page)).left).toBeGreaterThan(70)
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('TEXTAREA')
  const bar = page.locator('[data-tmux-cc-actions]')
  const br = (await bar.boundingBox())!
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: br.x + 250, y: br.y + 20 }] })
  for (let n = 1; n <= 6; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: br.x + 250 - n * 25, y: br.y + 20 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => bar.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
  const title = (await page.locator('[data-tmux-cc-ptitle]').first().boundingBox())!
  const target = (await page.locator('[data-tmux-cc-touch]').nth(1).boundingBox())!
  const from = { x: title.x + 30, y: title.y + 16 }
  const to = { x: target.x + 60, y: target.y + 60 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let n = 1; n <= 6; n++) await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * n / 6, y: from.y + (to.y - from.y) * n / 6 }],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(await messages(page, 'swap')).toEqual([{ type: 'swap', pane: '%1', target: '%2' }])
})
