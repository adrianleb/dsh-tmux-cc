import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const client = readFileSync(new URL('../../lib/client.js', import.meta.url), 'utf8')
const xterm = readFileSync(require.resolve('@xterm/xterm/lib/xterm.js'), 'utf8')
const xtermCss = readFileSync(require.resolve('@xterm/xterm/css/xterm.css'), 'utf8')

interface ManagedSession { name: string; windows: number; attached: number }
interface ManagedClient {
  name: string
  pid: number
  created: number
  session: string
  tty: string
  term: string
  cols: number
  rows: number
  flags: string[]
  control: boolean
  own: boolean
}
interface Inventory { sessions: ManagedSession[]; clients: ManagedClient[] }
interface Request { type: string; requestId: string; [key: string]: unknown }

const alpha = 'fixture-alpha'
const beta = 'fixture-beta'
const ownName = 'fixture-own-control'
const alphaOne = 'fixture-alpha-one'
const alphaTwo = 'fixture-alpha-two'
const betaOne = 'fixture-beta-one'

function inventory(): Inventory {
  const makeClient = (name: string, pid: number, session: string, own = false): ManagedClient => ({
    name, pid, created: 1_700_000_000 + pid, session, tty: own ? '' : `/dev/pts/${pid}`,
    term: own ? '' : 'xterm-256color', cols: 120, rows: 40, flags: own ? ['control-mode'] : [],
    control: own, own,
  })
  return {
    sessions: [{ name: alpha, windows: 2, attached: 3 }, { name: beta, windows: 1, attached: 1 }],
    clients: [makeClient(ownName, 101, alpha, true), makeClient(alphaOne, 102, alpha),
      makeClient(alphaTwo, 103, alpha), makeClient(betaOne, 104, beta)],
  }
}

// Same real-xterm / synthetic transport boot as interactions.spec.ts. No real
// WebSocket, tmux process, user session, or GUI runtime is accessed by this file.
// Mutations and explicitly requested inventories are answered by each test, so
// pending/correlation paths cannot pass through synchronous fake success. Idle
// inventory polls and error reconciliation receive the latest synthetic data.
async function boot(page: Page, options: { mobile?: boolean; detached?: boolean; data?: Inventory } = {}) {
  const { mobile = false, detached = false, data = inventory() } = options
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.route('http://tmux.test/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"><div><main data-slot="conversation"></main></div></div>',
  }))
  await page.goto('http://tmux.test/')
  await page.addStyleTag({ content: xtermCss })
  await page.addScriptTag({ content: xterm })
  await page.evaluate(({ detached, data }) => {
    const w = window as any
    w.sent = []
    w.inventory = data
    w.autoManagement = false
    w.snapshot = {
      attached: !detached, session: detached ? null : 'fixture-alpha', cols: 120, rows: 40, sizeMode: 'mirror',
      sessions: data.sessions,
      windows: detached ? [] : [{ id: '@1', name: 'fixture', active: true }],
      panes: detached ? [] : [{ id: '%1', left: 0, top: 0, width: 120, height: 40, active: true, title: 'Fixture' }],
    }
    class Socket {
      readyState = 1
      onopen?: () => void
      onmessage?: (event: { data: string }) => void
      constructor() { w.socket = this; setTimeout(() => this.onopen?.(), 0) }
      send(data: string) {
        const message = JSON.parse(data)
        w.sent.push(message)
        if (message.type === 'management' && w.autoManagement) queueMicrotask(() => {
          this.onmessage?.({ data: JSON.stringify({ type: 'management', requestId: message.requestId, ...w.inventory }) })
        })
        if (message.type === 'hello') this.onmessage?.({ data: JSON.stringify({ type: 'snapshot', snapshot: w.snapshot }) })
        if (message.type === 'capture') for (const pane of w.snapshot.panes) {
          if (!message.pane || message.pane === pane.id) {
            this.onmessage?.({ data: JSON.stringify({ type: 'history', pane: pane.id, data: 'Synthetic management fixture\r\n' }) })
          }
        }
      }
      close() { this.readyState = 3 }
    }
    w.WebSocket = Socket
    localStorage.setItem('dsh-tmux-cc:dock', JSON.stringify({ prefs: { open: true, session: '', size: 500, mobileFontFloor: 12 } }))
    w.__ModuleLoader__ = { load({ factory }: any) {
      factory(() => ({ createElement() {} })).apply({
        settingsScope: { bind: () => ({}) },
        effect: (fn: any) => fn(),
        slots: { inject() {} },
      })
    } }
  }, { detached, data })
  await page.addScriptTag({ content: client })
  await expect(page.locator('[data-tmux-cc-shell]')).toBeVisible()
  await expect.poll(() => messages(page, 'hello')).toHaveLength(1)
  await expect(page.locator('.xterm')).toHaveCount(detached ? 0 : 1)
  await frames(page)
}

async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
}
async function messages(page: Page, type: string): Promise<Request[]> {
  return page.evaluate(type => (window as any).sent.filter((message: Request) => message.type === type), type)
}
async function request(page: Page, type: string, index = 0): Promise<Request> {
  await expect.poll(async () => (await messages(page, type)).length).toBeGreaterThan(index)
  const message = (await messages(page, type))[index]
  expect(message.requestId).toEqual(expect.any(String))
  expect(message.requestId.length).toBeGreaterThan(0)
  return message
}
async function deliver(page: Page, message: object) {
  await page.evaluate(message => (window as any).socket.onmessage({ data: JSON.stringify(message) }), message)
  await frames(page)
}
async function succeed(page: Page, message: Request, data = inventory()) {
  await page.evaluate(data => {
    const w = window as any
    w.inventory = data
    w.autoManagement = true
  }, data)
  await deliver(page, { type: 'management', requestId: message.requestId, ...data })
}
async function holdManagement(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as any
    w.autoManagement = false
    return w.sent.filter((message: Request) => message.type === 'management').length
  })
}
async function refreshManager(page: Page) {
  const index = await holdManagement(page)
  await manager(page).getByRole('button', { name: 'Refresh', exact: true }).click()
  return request(page, 'management', index)
}
const manager = (page: Page) => page.locator('[data-tmux-cc-manager]')
const sessionRow = (page: Page, name: string) => manager(page).locator('[data-tmux-cc-session-row]').filter({ hasText: name })
const clientRow = (page: Page, name: string) => manager(page).locator('[data-tmux-cc-client-row]').filter({
  has: page.getByRole('checkbox', { name }),
})
const clientCheckbox = (page: Page, name: string) => clientRow(page, name).getByRole('checkbox')
const detachButton = (page: Page, count: number) => manager(page).getByRole('button', { name: `Detach selected (${count})`, exact: true })

async function openManager(page: Page, data = inventory()) {
  const index = await holdManagement(page)
  await page.locator('button[data-tmux-cc-manage]').click()
  await expect(manager(page)).toBeVisible()
  await expect(manager(page)).toHaveJSProperty('tagName', 'DIALOG')
  await expect(manager(page)).toHaveJSProperty('open', true)
  const message = await request(page, 'management', index)
  expect(message).toEqual({ type: 'management', requestId: message.requestId })
  await succeed(page, message, data)
  await expect(manager(page).locator('[data-tmux-cc-session-row]')).toHaveCount(data.sessions.length)
  await expect(manager(page).locator('[data-tmux-cc-client-row]')).toHaveCount(data.clients.length)
  return message
}

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} manager is a viewport-contained native modal and restores focus`, async ({ page }) => {
    const data = inventory()
    // Force vertical scrolling rather than accidentally testing only a short dialog.
    for (let i = 0; i < 12; i++) data.clients.push({
      ...data.clients[1], name: `fixture-extra-client-${i}`, pid: 200 + i, created: 1_700_000_200 + i,
    })
    await boot(page, { mobile, data })
    await openManager(page, data)
    expect(await manager(page).evaluate(node => node.matches(':modal'))).toBe(true)
    expect(await manager(page).evaluate(node => node.contains(document.activeElement))).toBe(true)
    const assertFits = async () => {
      const box = (await manager(page).boundingBox())!
      const viewport = page.viewportSize()!
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
      expect(box.x).toBeGreaterThanOrEqual(-1)
      expect(box.y).toBeGreaterThanOrEqual(-1)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
      const width = await manager(page).evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }))
      expect(width.scroll).toBeLessThanOrEqual(width.client + 1)
    }
    await assertFits()
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 480 })
      await frames(page)
      await assertFits()
    }
    await page.keyboard.press('Escape')
    await expect(manager(page)).not.toBeVisible()
    await expect(page.locator('[data-tmux-cc-shell]')).toBeVisible()
    await expect(page.locator('button[data-tmux-cc-manage]')).toBeFocused()
    await openManager(page, data)
    await manager(page).locator('[data-tmux-cc-client-row]').last().scrollIntoViewIfNeeded()
    await expect.poll(() => manager(page).evaluate(node => node.scrollTop)).toBeGreaterThan(0)
    const done = manager(page).getByRole('button', { name: 'Done', exact: true })
    // Assert before clicking: Playwright's automatic scrolling must not hide a
    // regression where mobile users must return to the top to close the dialog.
    await expect(done).toBeInViewport({ ratio: 1 })
    await done.click()
    await expect(manager(page)).not.toBeVisible()
    await expect(page.locator('button[data-tmux-cc-manage]')).toBeFocused()
    expect(await messages(page, 'detach')).toHaveLength(0)
    expect(await messages(page, 'detach-clients')).toHaveLength(0)
  })
}

test('create includes cwd, stays pending, and attaches only after its correlated success', async ({ page }) => {
  await boot(page)
  await openManager(page)
  const form = manager(page).locator('[data-tmux-cc-create-form]')
  const name = form.getByRole('textbox', { name: 'Session name', exact: true })
  const cwd = form.getByRole('textbox', { name: 'Starting directory (optional)', exact: true })
  const attach = form.getByRole('checkbox', { name: 'Attach after creating', exact: true })
  await expect(attach).toBeChecked()
  await name.fill('fixture-created')
  await cwd.fill('/tmp/synthetic project')
  await form.getByRole('button', { name: 'Create session', exact: true }).click()
  const create = await request(page, 'create-session')
  expect(create).toEqual({ type: 'create-session', requestId: create.requestId, name: 'fixture-created', cwd: '/tmp/synthetic project' })
  await expect(form.getByRole('button', { name: 'Create session', exact: true })).toBeDisabled()
  await expect(manager(page).getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
  expect(await messages(page, 'attach')).toHaveLength(0)
  // An unrelated response must not complete creation or trigger its follow-up attach.
  await deliver(page, { type: 'management', requestId: 'unrelated-success', ...inventory() })
  await expect(form.getByRole('button', { name: 'Create session', exact: true })).toBeDisabled()
  expect(await messages(page, 'attach')).toHaveLength(0)
  const data = inventory()
  data.sessions.push({ name: 'fixture-created', windows: 1, attached: 0 })
  await succeed(page, create, data)
  await expect.poll(() => messages(page, 'attach')).toEqual([{ type: 'attach', session: 'fixture-created' }])
  // Duplicate transport delivery must not perform the follow-up action twice.
  await succeed(page, create, data)
  expect(await messages(page, 'attach')).toEqual([{ type: 'attach', session: 'fixture-created' }])
})

test('detached with no sessions can create without cwd or an automatic attach', async ({ page }) => {
  const empty: Inventory = { sessions: [], clients: [] }
  await boot(page, { mobile: true, detached: true, data: empty })
  await openManager(page, empty)
  const form = manager(page).locator('[data-tmux-cc-create-form]')
  await expect(form).toBeVisible()
  await form.getByRole('textbox', { name: 'Session name', exact: true }).fill('fixture-unattached')
  await form.getByRole('checkbox', { name: 'Attach after creating', exact: true }).uncheck()
  await form.getByRole('button', { name: 'Create session', exact: true }).click()
  const create = await request(page, 'create-session')
  expect(create).toEqual({ type: 'create-session', requestId: create.requestId, name: 'fixture-unattached' })
  const data = { sessions: [{ name: 'fixture-unattached', windows: 1, attached: 0 }], clients: [] }
  await succeed(page, create, data)
  await expect(manager(page)).toBeVisible()
  await expect(sessionRow(page, 'fixture-unattached')).toBeVisible()
  await expect(form.getByRole('button', { name: 'Create session', exact: true })).toBeEnabled()
  // A later detached snapshot must not silently auto-attach the newly-created session.
  await page.evaluate(data => { (window as any).snapshot.sessions = data.sessions }, data)
  await page.evaluate(() => {
    const w = window as any
    w.socket.onmessage({ data: JSON.stringify({ type: 'snapshot', snapshot: w.snapshot }) })
  })
  await frames(page)
  expect(await messages(page, 'attach')).toHaveLength(0)
})

test('correlated create errors retain all form values and permit a fresh retry', async ({ page }) => {
  await boot(page)
  await openManager(page)
  const form = manager(page).locator('[data-tmux-cc-create-form]')
  const name = form.getByRole('textbox', { name: 'Session name', exact: true })
  const cwd = form.getByRole('textbox', { name: 'Starting directory (optional)', exact: true })
  const attach = form.getByRole('checkbox', { name: 'Attach after creating', exact: true })
  await name.fill('fixture-retry')
  await cwd.fill('/tmp/not-present')
  await attach.uncheck()
  await form.getByRole('button', { name: 'Create session', exact: true }).click()
  const first = await request(page, 'create-session')
  await deliver(page, { type: 'error', requestId: 'unrelated-error', message: 'Not this operation' })
  await expect(form.getByRole('button', { name: 'Create session', exact: true })).toBeDisabled()
  await expect(manager(page)).not.toContainText('Not this operation')
  await deliver(page, { type: 'error', requestId: first.requestId, message: 'Starting directory does not exist' })
  await expect(manager(page)).toContainText('Starting directory does not exist')
  await expect(name).toHaveValue('fixture-retry')
  await expect(cwd).toHaveValue('/tmp/not-present')
  await expect(attach).not.toBeChecked()
  await expect(form.getByRole('button', { name: 'Create session', exact: true })).toBeEnabled()
  expect(await messages(page, 'attach')).toHaveLength(0)
  await cwd.fill('/tmp/synthetic-valid')
  await form.getByRole('button', { name: 'Create session', exact: true }).click()
  const retry = await request(page, 'create-session', 1)
  expect(retry.requestId).not.toBe(first.requestId)
  expect(retry).toEqual({ type: 'create-session', requestId: retry.requestId, name: 'fixture-retry', cwd: '/tmp/synthetic-valid' })
  await deliver(page, { type: 'error', requestId: first.requestId, message: 'Stale failure from first attempt' })
  await expect(form.getByRole('button', { name: 'Create session', exact: true })).toBeDisabled()
  await expect(manager(page)).not.toContainText('Stale failure from first attempt')
  const data = inventory()
  data.sessions.push({ name: 'fixture-retry', windows: 1, attached: 0 })
  await succeed(page, retry, data)
  await expect(sessionRow(page, 'fixture-retry')).toBeVisible()
  await expect(manager(page)).not.toContainText('Starting directory does not exist')
  expect(await messages(page, 'attach')).toHaveLength(0)
})

test('session Attach sends only the existing attach wire command', async ({ page }) => {
  await boot(page, { detached: true })
  await openManager(page)
  await sessionRow(page, beta).getByRole('button', { name: 'Attach', exact: true }).click()
  expect(await messages(page, 'attach')).toEqual([{ type: 'attach', session: beta }])
  expect(await messages(page, 'create-session')).toHaveLength(0)
  expect(await messages(page, 'rename-session')).toHaveLength(0)
  expect(await messages(page, 'detach-clients')).toHaveLength(0)
})

test('inline rename can cancel, retains errors, and saves the captured session name', async ({ page }) => {
  await boot(page)
  await openManager(page)
  const row = sessionRow(page, beta)
  await row.getByRole('button', { name: 'Rename', exact: true }).click()
  await row.getByRole('textbox', { name: 'New session name', exact: true }).fill('fixture-canceled')
  await row.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(row.getByRole('textbox', { name: 'New session name', exact: true })).toHaveCount(0)
  expect(await messages(page, 'rename-session')).toHaveLength(0)
  await row.getByRole('button', { name: 'Rename', exact: true }).click()
  const name = row.getByRole('textbox', { name: 'New session name', exact: true })
  await expect(name).toHaveValue(beta)
  await name.fill('fixture-renamed')
  await row.getByRole('button', { name: 'Save', exact: true }).click()
  const rename = await request(page, 'rename-session')
  expect(rename).toEqual({ type: 'rename-session', requestId: rename.requestId, session: beta, newName: 'fixture-renamed' })
  await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await deliver(page, { type: 'error', requestId: rename.requestId, message: 'Synthetic rename conflict' })
  await expect(manager(page)).toContainText('Synthetic rename conflict')
  await expect(name).toHaveValue('fixture-renamed')
  await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await row.getByRole('button', { name: 'Save', exact: true }).click()
  const retry = await request(page, 'rename-session', 1)
  expect(retry.requestId).not.toBe(rename.requestId)
  const data = inventory()
  data.sessions[1].name = 'fixture-renamed'
  data.clients = data.clients.map(client => client.session === beta ? { ...client, session: 'fixture-renamed' } : client)
  await succeed(page, retry, data)
  await expect(sessionRow(page, beta)).toHaveCount(0)
  await expect(sessionRow(page, 'fixture-renamed')).toBeVisible()
  await expect(manager(page).getByRole('textbox', { name: 'New session name', exact: true })).toHaveCount(0)
  await expect(clientRow(page, betaOne)).toContainText('fixture-renamed')
  expect(await messages(page, 'attach')).toHaveLength(0)
})

test('filtered selection protects own client and detach confirms exact selected identities', async ({ page }) => {
  const data = inventory()
  await boot(page)
  await openManager(page, data)
  const filter = manager(page).getByRole('combobox', { name: 'Filter clients by session', exact: true })
  await expect(filter.locator('option:checked')).toHaveText('All sessions')
  await expect(clientCheckbox(page, ownName)).toBeDisabled()
  await expect(clientCheckbox(page, ownName)).not.toBeChecked()
  for (const client of data.clients) await expect(clientRow(page, client.name)).toContainText(client.session)
  await expect(detachButton(page, 0)).toBeDisabled()
  await manager(page).getByRole('button', { name: 'Select all', exact: true }).click()
  await expect(detachButton(page, 3)).toBeEnabled()
  await expect(clientCheckbox(page, ownName)).not.toBeChecked()
  await manager(page).getByRole('button', { name: 'Clear selection', exact: true }).click()
  await expect(detachButton(page, 0)).toBeDisabled()
  await filter.selectOption({ label: alpha })
  await expect(clientRow(page, betaOne)).not.toBeVisible()
  await manager(page).getByRole('button', { name: 'Select all', exact: true }).click()
  await expect(clientCheckbox(page, alphaOne)).toBeChecked()
  await expect(clientCheckbox(page, alphaTwo)).toBeChecked()
  await expect(detachButton(page, 2)).toBeEnabled()
  await filter.selectOption({ label: beta })
  await expect(detachButton(page, 0)).toBeDisabled()
  await clientCheckbox(page, betaOne).check()
  await expect(detachButton(page, 1)).toBeEnabled()
  // Changing the filter clears hidden selections, avoiding surprising detaches.
  await filter.selectOption({ label: 'All sessions' })
  await expect(detachButton(page, 0)).toBeDisabled()
  await clientCheckbox(page, alphaOne).check()
  await clientCheckbox(page, betaOne).check()
  await expect(detachButton(page, 2)).toBeEnabled()
  const selected = [data.clients[1], data.clients[3]]
  let canceled = ''
  page.once('dialog', async dialog => { canceled = dialog.message(); await dialog.dismiss() })
  await detachButton(page, 2).click()
  for (const client of selected) { expect(canceled).toContain(client.name); expect(canceled).toContain(client.session) }
  expect(canceled).not.toContain(ownName)
  expect(canceled).not.toContain(alphaTwo)
  expect(await messages(page, 'detach-clients')).toHaveLength(0)
  await expect(clientCheckbox(page, alphaOne)).toBeChecked()
  await expect(clientCheckbox(page, betaOne)).toBeChecked()
  let confirmed = ''
  page.once('dialog', async dialog => { confirmed = dialog.message(); await dialog.accept() })
  await detachButton(page, 2).click()
  expect(confirmed).toBe(canceled)
  const detach = await request(page, 'detach-clients')
  const identities = selected.map(({ name, pid, created }) => ({ name, pid, created }))
  expect(detach).toEqual({ type: 'detach-clients', requestId: detach.requestId, clients: expect.arrayContaining(identities) })
  expect(detach.clients).toHaveLength(2)
  await expect(detachButton(page, 2)).toBeDisabled()
  await expect(clientCheckbox(page, alphaOne)).toBeDisabled()
  await expect(manager(page).getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
  await succeed(page, detach, { ...data, clients: data.clients.filter(client => !selected.includes(client)) })
  await expect(clientRow(page, alphaOne)).toHaveCount(0)
  await expect(clientRow(page, betaOne)).toHaveCount(0)
  await expect(clientCheckbox(page, ownName)).toBeDisabled()
  await expect(detachButton(page, 0)).toBeDisabled()
  expect(await messages(page, 'detach')).toHaveLength(0)
})

test('detach errors reconcile partial effects before enabling a retry of remaining identities', async ({ page }) => {
  const data = inventory()
  await boot(page)
  await openManager(page, data)
  await clientCheckbox(page, alphaOne).check()
  await clientCheckbox(page, alphaTwo).check()
  page.once('dialog', dialog => dialog.accept())
  await detachButton(page, 2).click()
  const detach = await request(page, 'detach-clients')
  // Hold the automatic reconciliation to observe that retry stays unavailable
  // until the UI knows which of the captured targets still exists.
  const index = await holdManagement(page)
  await deliver(page, { type: 'error', requestId: detach.requestId, message: 'One selected client disappeared' })
  await expect(manager(page)).toContainText('One selected client disappeared')
  const reconcile = await request(page, 'management', index)
  await expect(detachButton(page, 2)).toBeDisabled()
  await expect(clientCheckbox(page, alphaTwo)).toBeDisabled()
  const reconciled = { ...data, clients: data.clients.filter(client => client.name !== alphaOne) }
  await succeed(page, reconcile, reconciled)
  await expect(clientRow(page, alphaOne)).toHaveCount(0)
  await expect(clientCheckbox(page, alphaTwo)).toBeChecked()
  await expect(clientCheckbox(page, ownName)).toBeDisabled()
  await expect(detachButton(page, 1)).toBeEnabled()
  await expect(manager(page)).toContainText('One selected client disappeared')
  let confirmation = ''
  page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.accept() })
  await detachButton(page, 1).click()
  expect(confirmation).toContain(alphaTwo)
  expect(confirmation).not.toContain(alphaOne)
  const retry = await request(page, 'detach-clients', 1)
  const { name, pid, created } = data.clients[2]
  expect(retry).toEqual({ type: 'detach-clients', requestId: retry.requestId, clients: [{ name, pid, created }] })
  expect(retry.requestId).not.toBe(detach.requestId)
  await succeed(page, retry, { ...reconciled, clients: reconciled.clients.filter(client => client.name !== alphaTwo) })
  await expect(detachButton(page, 0)).toBeDisabled()
  await expect(manager(page)).not.toContainText('One selected client disappeared')
})

test('refresh removes missing and replaced identities without clearing still-valid selections', async ({ page }) => {
  const data = inventory()
  await boot(page)
  const first = await openManager(page, data)
  await manager(page).getByRole('button', { name: 'Select all', exact: true }).click()
  await expect(detachButton(page, 3)).toBeEnabled()
  const refresh = await refreshManager(page)
  expect(refresh.requestId).not.toBe(first.requestId)
  await expect(manager(page).getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
  // Old replies must not overwrite current cards or finish a newer request.
  await deliver(page, { type: 'management', requestId: first.requestId, sessions: [], clients: [] })
  await expect(manager(page).getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
  await expect(clientRow(page, alphaOne)).toBeVisible()
  // Same name AND pid, but a different creation time, is a new client identity.
  const replacement = { ...data.clients[1], created: data.clients[1].created + 1 }
  const refreshed = { ...data, clients: [data.clients[0], replacement, data.clients[3]] }
  await succeed(page, refresh, refreshed)
  await expect(clientCheckbox(page, alphaOne)).not.toBeChecked()
  await expect(clientRow(page, alphaTwo)).toHaveCount(0)
  await expect(clientCheckbox(page, betaOne)).toBeChecked()
  await expect(clientCheckbox(page, ownName)).toBeDisabled()
  await expect(detachButton(page, 1)).toBeEnabled()
  // Reused name/creation timestamp with a different PID is also a replacement.
  await clientCheckbox(page, alphaOne).check()
  const secondRefresh = await refreshManager(page)
  const changedPid = { ...replacement, pid: replacement.pid + 1000 }
  await succeed(page, secondRefresh, { ...refreshed, clients: [data.clients[0], changedPid, data.clients[3]] })
  await expect(clientCheckbox(page, alphaOne)).not.toBeChecked()
  await expect(clientCheckbox(page, betaOne)).toBeChecked()
  let confirmation = ''
  page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.accept() })
  await detachButton(page, 1).click()
  expect(confirmation).toContain(betaOne)
  expect(confirmation).toContain(beta)
  expect(confirmation).not.toContain(alphaOne)
  const detach = await request(page, 'detach-clients')
  const { name, pid, created } = data.clients[3]
  expect(detach).toEqual({ type: 'detach-clients', requestId: detach.requestId, clients: [{ name, pid, created }] })
  await succeed(page, detach, { ...refreshed, clients: [data.clients[0], changedPid] })
  await expect(detachButton(page, 0)).toBeDisabled()
})
