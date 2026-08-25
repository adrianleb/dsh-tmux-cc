import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('client bundle invariants', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(src, /data-tmux-cc-shell/)
  assert.match(src, /data-tmux-cc-session/)
  assert.match(src, /data-tmux-cc-tab/)
  assert.match(src, /function paint\(/)
  // No react-dom at load; DOM painting only.
  assert.doesNotMatch(src, /require\('react-dom\/client'\)/)
  // Faithful sizing: no fit addon; the grid mirrors the tmux pane cells.
  assert.doesNotMatch(src, /FitAddon/)
  assert.doesNotMatch(src, /addon-fit/)
  assert.match(src, /term\.resize\(pane\.width, pane\.height\)/)
  // Keyboard handling is scoped to the dock, never window-global stealing.
  assert.match(src, /host\.contains\(event\.target\)/)
  // Reconnect re-seeds from an authoritative capture.
  assert.match(src, /type: 'capture'/)
  assert.match(src, /maybeAutoAttach/)
  // Takeover sizing: the dock reports its native-font grid to the host.
  assert.match(src, /type: 'resize'/)
  assert.match(src, /reportDockGrid/)
  assert.match(src, /sizeMode/)
  // Mobile: a real narrow breakpoint, full-screen drawer, visual keyboard inset,
  // and one readable active pane selected through pane tabs.
  assert.match(src, /NARROW_MAX_WIDTH = 768/)
  assert.match(src, /@media \(max-width:767px\)/)
  assert.match(src, /window\.visualViewport/)
  assert.match(src, /vv\.height \+ \(vv\.offsetTop/)
  assert.match(src, /data-tmux-cc-pane-tabs/)
  assert.match(src, /data-tmux-cc-pane-tab/)
  assert.match(src, /prefs\.open && !isNarrowViewport\(\)/)
  assert.match(src, /data-mobile="1"/)
  // Inline tmux geometry must not survive when a mobile pane becomes active.
  assert.match(src, /left:0 !important;top:0 !important;width:100% !important;height:100% !important/)
  // IME composition keys must never trigger tmux shortcuts.
  assert.match(src, /event\.isComposing \|\| event\.keyCode === 229/)
})
