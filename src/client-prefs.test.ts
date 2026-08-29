import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function functionSource(name: string): string {
  const match = clientSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`))
  assert.ok(match, `missing ${name}`)
  return match[0]
}

function localPrefsNormalizer(): (value: unknown) => Record<string, unknown> {
  const defaults = clientSource.match(/const defaultPrefs = (\{[\s\S]*?\n    \})/)
  assert.ok(defaults)
  return Function(`
    const MAX_SCROLLBACK_LINES = 20000
    const defaultPrefs = ${defaults[1]}
    ${functionSource('sanitizeFontFamily')}
    ${functionSource('normalizeLocalPrefs')}
    return normalizeLocalPrefs
  `)() as (value: unknown) => Record<string, unknown>
}

test('browser preference migration applies defaults and strips unknown keys', () => {
  const normalize = localPrefsNormalizer()
  assert.deepEqual(normalize({}), {
    open: false,
    side: 'bottom',
    size: 280,
    session: '',
    fontFamily: '',
    fontSize: 12,
    cursorStyle: 'block',
    cursorBlink: true,
    scrollbackLines: 2000,
    confirmKill: true,
    applyFontToHarness: false,
  })

  const normalized = normalize({
    open: true,
    side: 'sideways',
    size: 9000,
    session: 's'.repeat(250),
    fontFamily: 'mono;background:red',
    fontSize: 99,
    cursorStyle: 'beam',
    cursorBlink: false,
    scrollbackLines: 999999,
    confirmKill: false,
    applyFontToHarness: true,
    injected: 'never persisted',
  })
  assert.equal(normalized.open, true)
  assert.equal(normalized.side, 'bottom')
  assert.equal(normalized.size, 3000)
  assert.equal((normalized.session as string).length, 200)
  assert.equal(normalized.fontFamily, '')
  assert.equal(normalized.fontSize, 32)
  assert.equal(normalized.cursorStyle, 'block')
  assert.equal(normalized.cursorBlink, false)
  assert.equal(normalized.scrollbackLines, 20000)
  assert.equal(normalized.confirmKill, false)
  assert.equal(normalized.applyFontToHarness, true)
  assert.equal(Object.hasOwn(normalized, 'injected'), false)
})

test('kill confirmation arms the first action and accepts the repeated action', () => {
  const source = functionSource('shouldArmKill')
  const shouldArmKill = Function(`return (${source})`)() as (
    enabled: boolean,
    armedId: string,
    requestedId: string,
  ) => boolean
  assert.equal(shouldArmKill(true, '', 'pane:%1'), true)
  assert.equal(shouldArmKill(true, 'pane:%1', 'pane:%1'), false)
  assert.equal(shouldArmKill(true, 'pane:%1', 'pane:%2'), true)
  assert.equal(shouldArmKill(false, '', 'pane:%1'), false)
})
