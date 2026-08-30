import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PREFS, sanitizeFontFamily } from './types.ts'

test('sanitizeFontFamily keeps CSS family stacks and drops injections', () => {
  assert.equal(sanitizeFontFamily('"Berkeley Mono", monospace'), '"Berkeley Mono", monospace')
  assert.equal(sanitizeFontFamily('  JetBrains Mono  '), 'JetBrains Mono')
  assert.equal(sanitizeFontFamily(''), '')
  assert.equal(sanitizeFontFamily(undefined), '')
  assert.equal(sanitizeFontFamily('foo;background:red'), '')
  assert.equal(sanitizeFontFamily('foo}body{color:red'), '')
  assert.equal(sanitizeFontFamily('x'.repeat(301)), '')
})

test('default dock prefs leave fontFamily empty (client supplies the system stack)', () => {
  assert.equal(DEFAULT_PREFS.fontFamily, '')
  assert.equal(DEFAULT_PREFS.fontSize, 12)
  assert.equal(DEFAULT_PREFS.cursorStyle, 'block')
  assert.equal(DEFAULT_PREFS.cursorBlink, true)
  assert.equal(DEFAULT_PREFS.scrollbackLines, 2000)
  assert.equal(DEFAULT_PREFS.confirmKill, true)
  assert.equal(DEFAULT_PREFS.compactSplitShortcuts, false)
  assert.equal(DEFAULT_PREFS.applyFontToHarness, false)
})
