import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function functionSource(name: string): string {
  const match = clientSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`))
  assert.ok(match, `missing ${name}`)
  return match[0]
}

type KeyEvent = {
  key: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}

const resolvers = Function(`
  ${functionSource('exactModifiers')}
  ${functionSource('resolveItermShortcut')}
  ${functionSource('isPrefixKey')}
  ${functionSource('resolvePrefixShortcut')}
  return { resolveItermShortcut, isPrefixKey, resolvePrefixShortcut }
`)() as {
  resolveItermShortcut(event: KeyEvent, isMac: boolean, compactSplits?: boolean): string | null
  isPrefixKey(event: KeyEvent): boolean
  resolvePrefixShortcut(event: KeyEvent): string | null
}

function key(keyValue: string, modifiers: Omit<KeyEvent, 'key'> = {}): KeyEvent {
  return { key: keyValue, code: modifiers.code, ...modifiers }
}

test('safe iTerm2 macOS chords map to tmux cockpit actions', () => {
  const resolve = resolvers.resolveItermShortcut
  assert.equal(resolve(key('D', { code: 'KeyD', ctrlKey: true, shiftKey: true, metaKey: true }), true), 'detach')
  assert.equal(resolve(key('N', { code: 'KeyN', ctrlKey: true, shiftKey: true, metaKey: true }), true), 'new-window')
  assert.equal(resolve(key('T', { code: 'KeyT', ctrlKey: true, shiftKey: true, metaKey: true }), true), 'new-window')
  assert.equal(resolve(key('Enter', { shiftKey: true, metaKey: true }), true), 'zoom')
  assert.equal(resolve(key('ArrowLeft', { ctrlKey: true, metaKey: true }), true), 'resize:L')
  assert.equal(resolve(key('ArrowDown', { ctrlKey: true, metaKey: true }), true), 'resize:D')
  assert.equal(resolve(key('≈', { code: 'KeyX', altKey: true, metaKey: true }), true), 'kill')
  assert.equal(resolve(key('˙', { code: 'KeyH', altKey: true, shiftKey: true, metaKey: true }), true), 'split:v')
  assert.equal(resolve(key('√', { code: 'KeyV', altKey: true, shiftKey: true, metaKey: true }), true), 'split:h')
  assert.equal(resolve(key('N', { code: 'KeyN', altKey: true, shiftKey: true, metaKey: true }), true), 'new-window')
  assert.equal(resolve(key('D', { code: 'KeyD', ctrlKey: true, shiftKey: true, metaKey: true }), false), null)
  assert.equal(resolve(key('≈', { code: 'KeyX', altKey: true, metaKey: true }), false), null)
})

test('browser-reserved iTerm2 chords are deliberately not captured', () => {
  const resolve = resolvers.resolveItermShortcut
  assert.equal(resolve(key('d', { code: 'KeyD', metaKey: true }), true), null)
  assert.equal(resolve(key('D', { code: 'KeyD', shiftKey: true, metaKey: true }), true), null)
  assert.equal(resolve(key('w', { code: 'KeyW', metaKey: true }), true), null)
  assert.equal(resolve(key('w', { code: 'KeyW', ctrlKey: true, metaKey: true }), true), null)
  assert.equal(resolve(key('W', { code: 'KeyW', ctrlKey: true, shiftKey: true, metaKey: true }), true), null)
  assert.equal(resolve(key('[', { metaKey: true }), true), null)
  assert.equal(resolve(key('ArrowLeft', { altKey: true, metaKey: true }), true), null)
  assert.equal(resolve(key('X', { code: 'KeyX', altKey: true, shiftKey: true, metaKey: true }), true), null)
  assert.equal(resolve(key('Enter', { ctrlKey: true, shiftKey: true, metaKey: true }), true), null)
})

test('compact Option-Command-D splits are browser-local opt-in mappings', () => {
  const resolve = resolvers.resolveItermShortcut
  const sideBySide = key('∂', { code: 'KeyD', altKey: true, metaKey: true })
  const topBottom = key('Î', { code: 'KeyD', altKey: true, shiftKey: true, metaKey: true })
  assert.equal(resolve(sideBySide, true, false), null)
  assert.equal(resolve(topBottom, true, false), null)
  assert.equal(resolve(sideBySide, true, true), 'split:h')
  assert.equal(resolve(topBottom, true, true), 'split:v')
  assert.equal(resolve(sideBySide, false, true), null)
})

test('prefix shortcuts require exact modifiers and cover safe tmux actions', () => {
  assert.equal(resolvers.isPrefixKey(key('b', { ctrlKey: true })), true)
  assert.equal(resolvers.isPrefixKey(key('B', { ctrlKey: true, shiftKey: true })), false)
  assert.equal(resolvers.resolvePrefixShortcut(key('b', { ctrlKey: true })), 'literal-prefix')
  assert.equal(resolvers.resolvePrefixShortcut(key('ArrowRight')), 'select:R')
  assert.equal(resolvers.resolvePrefixShortcut(key('x')), 'kill')
  assert.equal(resolvers.resolvePrefixShortcut(key('z')), 'zoom')
  assert.equal(resolvers.resolvePrefixShortcut(key('c')), 'new-window')
  assert.equal(resolvers.resolvePrefixShortcut(key('n')), 'window:next')
  assert.equal(resolvers.resolvePrefixShortcut(key('p')), 'window:previous')
  assert.equal(resolvers.resolvePrefixShortcut(key('7')), 'window:7')
  assert.equal(resolvers.resolvePrefixShortcut(key('d')), 'detach')
  assert.equal(resolvers.resolvePrefixShortcut(key('"', { shiftKey: true })), 'split:v')
  assert.equal(resolvers.resolvePrefixShortcut(key('%', { shiftKey: true })), 'split:h')
  assert.equal(resolvers.resolvePrefixShortcut(key('X', { shiftKey: true })), null)
  assert.equal(resolvers.resolvePrefixShortcut(key('ArrowLeft', { altKey: true })), null)
})

test('shortcut handler is terminal-scoped and restores literal Ctrl+B', () => {
  assert.match(clientSource, /target\.closest\('\.xterm'\)/)
  assert.match(clientSource, /prefixTimer = window\.setTimeout\(\(\) => clearPrefix\(true\), 1500\)/)
  assert.match(clientSource, /data: '\\u0002'/)
  assert.match(clientSource, /type: 'resize-pane-dir'/)
  assert.match(clientSource, /type: 'split', dir: action\.slice\(-1\), pane/)
  assert.match(clientSource, /type: 'split', dir: 'h', pane/)
  assert.match(clientSource, /type: 'split', dir: 'v', pane/)
  assert.match(clientSource, /type: 'new-window'/)
  assert.match(clientSource, /store\.requestKill\(focusedPane \? `pane:\$\{focusedPane\}` : 'active', focusedPane\)/)
  assert.doesNotMatch(clientSource, /event\.altKey && map\[event\.key\]/)
})
