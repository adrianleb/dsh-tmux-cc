import { test, expect } from '@playwright/test'

// Optional integration with the EXISTING DSH URL, never a replacement server.
// Intercept tmux's transport before navigation: no test input, resize, swap or
// kill can reach an operator's real panes. The shell and plugin assets are live.
for (const mobile of [false, true]) {
  test(`refreshed live GUI: ${mobile ? 'mobile' : 'desktop'} pane controls`, async ({ page }) => {
    test.skip(!process.env.DSH_GUI_URL, 'Set DSH_GUI_URL to verify the installed GUI')
    const sent: any[] = []
    const snapshot = {
      attached: true, session: 'synthetic-ux-only', cols: 160, rows: 80, sizeMode: 'mirror',
      sessions: [{ name: 'synthetic-ux-only' }], windows: [],
      panes: [
        { id: '%90001', left: 0, top: 0, width: 79, height: 39, active: true, title: 'Synthetic Alpha' },
        { id: '%90002', left: 80, top: 0, width: 80, height: 39, active: false, title: 'Synthetic Beta' },
        { id: '%90003', left: 0, top: 40, width: 79, height: 40, active: false, title: 'Synthetic Gamma' },
        { id: '%90004', left: 80, top: 40, width: 80, height: 40, active: false, title: 'Synthetic Delta' },
      ],
    }
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
    await page.routeWebSocket('**/tmux-cc/ws', socket => {
      socket.onMessage(raw => {
        const message = JSON.parse(String(raw)); sent.push(message)
        if (message.type === 'hello') socket.send(JSON.stringify({ type: 'snapshot', snapshot }))
        if (message.type === 'management' || message.type === 'create-session') {
          socket.send(JSON.stringify({ type: 'management', requestId: message.requestId,
            sessions: [{ name: 'synthetic-ux-only', attached: 1, windows: 1 }], clients: [],
          }))
        }
        if (message.type === 'capture') for (const pane of snapshot.panes) {
          socket.send(JSON.stringify({ type: 'history', pane: pane.id, data: 'Synthetic terminal fixture\r\nNo live process input.\r\n' }))
        }
      })
    })
    await page.addInitScript(() => localStorage.setItem('dsh-tmux-cc:dock', JSON.stringify({ prefs: { open: true, confirmKill: false, size: 500 } })))
    const bundles: Promise<boolean>[] = []
    page.on('response', response => {
      if (response.url().includes('/plugins/') && response.url().includes('dsh-tmux-cc/client.js')) {
        bundles.push(response.text().then(text => text.includes('function bindPaneTitle') && text.includes('function confirmPaneClose') && text.includes('function openManager')))
      }
    })
    await page.goto(process.env.DSH_GUI_URL!)
    await expect(page.locator('[data-tmux-cc-pane]')).toHaveCount(4)
    expect((await Promise.all(bundles)).some(Boolean)).toBe(true)
    await expect(page.locator('.xterm')).toHaveCount(4)
    // Verify the installed GUI exposes BOTH native divider directions for touch.
    // No command is forwarded to the running tmux server by this mock socket.
    for (const axis of ['x', 'y'] as const) {
      const sash = page.locator(`[data-tmux-cc-sash][data-dir="${axis === 'x' ? 'v' : 'h'}"]`).first()
      await expect(sash).toBeVisible()
      const r = (await sash.boundingBox())!
      if (mobile) expect(axis === 'x' ? r.width : r.height).toBeGreaterThanOrEqual(24)
      const event = { pointerId: 31, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }
      expect(await page.evaluate(e => !!document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-tmux-cc-sash]'), event)).toBe(true)
      await sash.dispatchEvent('pointerdown', event)
      await expect(sash).toHaveAttribute('data-active', '1')
      await page.evaluate(({ event, axis }) => window.dispatchEvent(new PointerEvent('pointermove', {
        ...event, clientX: event.clientX + (axis === 'x' ? 40 : 0), clientY: event.clientY + (axis === 'y' ? 40 : 0),
      })), { event, axis })
      await page.evaluate(event => window.dispatchEvent(new PointerEvent('pointerup', event)), event)
      await expect.poll(() => sent.filter(m => m.type === 'resize-pane' && (axis === 'x' ? m.width > 79 : m.height > 39)).length).toBeGreaterThan(0)
      await expect(page.locator('body')).not.toHaveAttribute('data-dsh-tmux-dragging')
    }
    expect(sent.some(m => m.type === 'input' || m.type === 'select')).toBe(false)
    const a = (await page.locator('[data-tmux-cc-ptitle]').first().boundingBox())!
    const b = (await page.locator('[data-tmux-cc-touch]').nth(1).evaluate(node => {
      const r = node.parentElement!.getBoundingClientRect(); return { x: r.x, y: r.y }
    }))
    await page.mouse.move(a.x + 40, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + 50, b.y + 50, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => sent.filter(m => m.type === 'swap')).toEqual([{ type: 'swap', pane: '%90001', target: '%90002' }])
    await page.locator('[data-tmux-cc-pclose]').nth(1).click()
    await expect.poll(() => sent.filter(m => m.type === 'kill')).toEqual([{ type: 'kill', pane: '%90002' }])
    await page.locator('[data-tmux-cc-manage]').click()
    const manager = page.locator('[data-tmux-cc-manager]')
    await expect(manager).toBeVisible()
    await expect(manager.locator('[data-tmux-cc-session-row]')).toContainText('synthetic-ux-only')
    await manager.getByLabel('Session name', { exact: true }).fill('synthetic-created-only')
    await manager.getByLabel('Attach after creating').uncheck()
    await manager.getByRole('button', { name: 'Create session', exact: true }).click()
    await expect.poll(() => sent.filter(m => m.type === 'create-session')).toHaveLength(1)
    expect(sent.some(m => m.type === 'attach')).toBe(false)
    await manager.getByRole('button', { name: 'Done', exact: true }).click()
    await page.locator('[data-tmux-cc-close]').click()
    await expect(page.locator('[data-tmux-cc-shell]')).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveAttribute('data-dsh-tmux-mobile-lock')
  })
}
