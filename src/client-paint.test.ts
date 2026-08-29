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
  // Visual boxes absorb tmux's one-cell separators so pane borders meet.
  assert.match(src, /function paneVisualBox\(/)
  assert.match(src, /pane\.width \+ \(pane\.left \+ pane\.width < cols \? 1 : 0\)/)
  assert.match(src, /pane\.height \+ \(pane\.top \+ pane\.height < rows \? 1 : 0\)/)
  const visualSource = src.match(/function paneVisualBox\(pane, cols, rows\) \{[\s\S]*?\n    \}/)?.[0]
  assert.ok(visualSource)
  const paneVisualBox = Function(`return (${visualSource})`)() as (
    pane: { left: number; top: number; width: number; height: number }, cols: number, rows: number,
  ) => { left: number; top: number; width: number; height: number }
  assert.deepEqual(paneVisualBox({ left: 0, top: 0, width: 79, height: 23 }, 160, 48), {
    left: 0, top: 0, width: 80, height: 24,
  })
  assert.deepEqual(paneVisualBox({ left: 80, top: 24, width: 80, height: 24 }, 160, 48), {
    left: 80, top: 24, width: 80, height: 24,
  })
  // Keyboard handling is scoped to the dock, never window-global stealing.
  assert.match(src, /host\.contains\(event\.target\)/)
  // Reconnect re-seeds from an authoritative capture.
  assert.match(src, /type: 'capture'/)
  assert.match(src, /maybeAutoAttach/)
  // Takeover sizing: the dock reports its native-font grid to the host.
  assert.match(src, /type: 'resize'/)
  assert.match(src, /reportDockGrid/)
  assert.match(src, /sizeMode/)
  // System fonts: xterm prefers Berkeley Mono (and other local families)
  // instead of a hardcoded ui-monospace stack, and Settings can apply the
  // same stack to DSH's code-font CSS variables.
  assert.match(src, /Berkeley Mono/)
  assert.match(src, /function termFontFamily\(/)
  assert.match(src, /function applyHarnessFont\(/)
  assert.match(src, /applyFontToHarness/)
  assert.match(src, /--ds-font-family-code/)
  assert.match(src, /queryLocalFonts/)
  // Mobile: a real narrow breakpoint and full-screen drawer with visual
  // keyboard insets, while preserving the actual tmux pane grid.
  assert.match(src, /NARROW_MAX_WIDTH = 768/)
  assert.match(src, /@media \(max-width:767px\)/)
  assert.match(src, /window\.visualViewport/)
  assert.match(src, /vv\.height \+ \(vv\.offsetTop/)
  assert.match(src, /prefs\.open && !isNarrowViewport\(\)/)
  assert.match(src, /data-mobile="1"/)
  assert.doesNotMatch(src, /data-tmux-cc-pane-tabs/)
  assert.doesNotMatch(src, /\[data-tmux-cc-pane\]\{display:none\}/)
  // Zoom is native tmux behavior, not a client-side single-pane invention.
  assert.match(src, /data-tmux-cc-zoom/)
  assert.match(src, /type: 'zoom', pane: pane\.id/)
  // IME composition keys must never trigger tmux shortcuts.
  assert.match(src, /event\.isComposing \|\| event\.keyCode === 229/)
  // Mobile stability: narrow viewports mirror the tmux grid and never
  // dictate the shared window size (keyboard/URL-bar churn caused resize
  // loops and shrank every other viewer through the min-size rule).
  const reportSrc = src.match(/function reportDockGrid\([\s\S]*?\n    \}/)?.[0]
  assert.ok(reportSrc)
  assert.match(reportSrc, /if \(isNarrowViewport\(\) \|\| document\.body\.dataset\.dshTmuxDragging\)/)
  assert.match(reportSrc, /store\.clearResize\(\)/)
  // Kill confirmation is preference-driven and applies to pointer and prefix-x actions.
  assert.match(src, /shouldArmKill\(prefs\.confirmKill, armedKill, id\)/)
  assert.match(src, /store\.requestKill\('active'\)/)
  assert.doesNotMatch(src, /lastPointerType/)
  // Touch: taps never summon the on-screen keyboard implicitly; the toolbar
  // keyboard toggle does, and terminals opt out of native panning.
  assert.match(src, /data-tmux-cc-kbd/)
  assert.match(src, /if \(ev\.pointerType === 'touch'\) return/)
  assert.match(src, /touchAction: 'none'/)
  // Touch scrolling is natural-direction with momentum, and holds repaints
  // while a gesture is active (auto-expiring so a lost touchend cannot wedge).
  assert.match(src, /gestureGuard/)
  assert.match(src, /const step = lastY - y/)
  assert.match(src, /requestAnimationFrame\(tick\)/)
  // Re-seeds preserve the reader's scrollback position instead of yanking
  // the viewport to the bottom.
  assert.match(src, /function writeSeed\(/)
  assert.match(src, /scrollLines\(-fromBottom\)/)
  // Visual-viewport inset jitter under 2px never repositions the shell, and
  // horizontal panning is accounted for as well as keyboard height.
  assert.match(src, /insetTop/)
  assert.match(src, /vv\.offsetLeft/)
  // The font fit is a one-step, one-degree-of-freedom calculation. The former
  // lineHeight/letterSpacing fixed-point recursion had a period-2 limit cycle.
  assert.match(src, /function fittedFontSize\(/)
  assert.doesNotMatch(src, /function fitPane\(rec, pane, tries\)/)
  assert.doesNotMatch(src, /term\.options\.lineHeight = lh/)
  assert.match(src, /term\.options\.letterSpacing = 0/)
  const fitSource = src.match(/function fittedFontSize\([\s\S]*?\n    \}/)?.[0]
  assert.ok(fitSource)
  const fittedFontSize = Function(`return (${fitSource})`)() as (
    current: number, screenWidth: number, screenHeight: number, hostWidth: number, hostHeight: number,
  ) => number
  assert.equal(fittedFontSize(12, 240, 240, 188, 300), 9.25)
  assert.equal(fittedFontSize(12, 240, 240, 240, 240), 12)
  assert.equal(fittedFontSize(12, 240, 240, 1000, 1000), 18)
  // Layout push is stylesheet-owned and additive with better-sidebar. No
  // inline margins remain on DSH's center column or AppFrame.
  assert.match(src, /data-dsh-tmux-conversation/)
  assert.match(src, /--dsh-sidebar-height,0px\) \+ var\(--dsh-tmux-height,0px\)/)
  assert.match(src, /right: 'var\(--dsh-sidebar-width, 0px\)'/)
  assert.doesNotMatch(src, /col\.style\.marginBottom/)
  assert.doesNotMatch(src, /frame\.style\.marginRight/)
  // A closed/mobile client retracts its takeover vote, and teardown closes its
  // websocket so HMR cannot leave ghost sizing clients behind.
  assert.match(src, /type: 'resize', active: false/)
  assert.match(src, /ws\.close\(1000, 'plugin unload'\)/)
  assert.match(src, /store\.dispose\(\)/)
  // Presentation preferences are versioned, explicitly normalized, and never
  // sent through the shared websocket.
  assert.match(src, /PREFS_VERSION = 2/)
  assert.match(src, /function normalizeLocalPrefs\(/)
  assert.match(src, /JSON\.stringify\(\{ version: PREFS_VERSION, prefs \}\)/)
  assert.doesNotMatch(src, /send\(\{ type: 'prefs'/)
  assert.doesNotMatch(src, /msg\.type === 'prefs'/)
  // New and existing xterms receive every terminal preference.
  assert.match(src, /cursorBlink: prefs\.cursorBlink/)
  assert.match(src, /cursorStyle: prefs\.cursorStyle/)
  assert.match(src, /scrollback: prefs\.scrollbackLines/)
  assert.match(src, /fontSize: prefs\.fontSize/)
  assert.match(src, /rec\.term\.options\.scrollback = prefs\.scrollbackLines/)
  assert.match(src, /measureCell\(body, termFontFamily\(prefs\), prefs\.fontSize\)/)
  // An xterm load that resolves after the pane was replaced cannot populate
  // the detached record for a reused tmux pane id.
  assert.match(src, /store\.panes\.get\(pane\.id\) !== rec/)
  // History requests carry the local depth and pane target; host settings use
  // the standard durable settings namespace instead of localStorage.
  assert.match(src, /type: 'capture', pane: id, lines: prefs\.scrollbackLines/)
  assert.match(src, /ctx\.settingsScope\.bind/)
  assert.match(src, /settingsScope\.set\('sizePolicy'/)
})
