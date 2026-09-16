# Interaction verification

## Release validation

The v0.7.1 dependency upgrade passed **143 unit tests**, **58 Chromium/WebKit browser tests**, and **2 isolated native tmux integration tests on both tmux 3.4 and 3.7b**, plus TypeScript 7.0.2 and build checks under Node 22. Two expected WebKit skips cover Chromium-only CDP input tests.

Touch resizing, scrolling, and keyboard-focus checks also passed three repetitions: 30 successful executions and six expected WebKit CDP skips. The existing DSH GUI was checked on desktop and mobile in both browser engines using synthetic terminal transport, without moving, resizing, closing, or typing into operator panes.

The live-GUI tests compare both served xterm asset hashes against the installed xterm 6.0.0 package. They initially caught the running host's cached 5.5 assets; after restarting the existing DSH Web process, all four live-GUI cases passed with matching JavaScript and CSS. The tmux server and existing pane processes were preserved through that restart.

Frozen installation with pnpm 12.4.2 passed; `pnpm outdated` reported no stale direct dependencies and `pnpm audit` reported zero known vulnerabilities. Node typings remain on the supported 22.x line. The exact-version release-age exception for `@types/node@22.20.3` was reviewed as a typings-only additive patch, with registry signatures and tarball integrity checked; future exceptions require explicit review.

## Reproduce the checks

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm exec playwright install --with-deps chromium webkit
pnpm test:browser
pnpm test:native

# Optional: verify an existing local DSH GUI, never a replacement server.
DSH_GUI_URL=http://127.0.0.1:3080 pnpm test:browser

# Optional executable overrides:
# CHROMIUM_PATH=/path/to/chrome pnpm test:browser
# TMUX_BIN=/path/to/tmux pnpm test:native
```

Browser tests use the shipped xterm with synthetic terminals. Existing-GUI checks intercept the tmux WebSocket before navigation so test commands cannot reach operator panes. Native tests force a separate, uniquely named tmux server and clean it up afterward. Browser and native tests run in CI, with failure traces retained as artifacts.

## Coverage

### Pane interaction

- Phone and touch-capable layouts expose visible divider grips with 24px hit areas. Width and height resizing survive incoming layout snapshots, repeated drags, cancellation, lost capture, removal, and breakpoint transitions. Only the outer full-screen mobile dock stays fixed.
- Title dragging swaps panes; terminal-body dragging only scrolls. Native tests verify geometry, refreshed snapshots, preserved focus, and rejection of invalid or foreign-window swap targets.
- Chromium receives trusted touch input over streaming output, toolbar rows, pane titles, and resize dividers. WebKit covers the same production handlers with simulated input where CDP is unavailable.
- Scrolling covers normal scrollback, alternate-screen arrows, mouse-reporting TUIs, accumulated wheel fragments, boundary reversal, momentum, and pinning the live prompt without disturbing historical reading positions.
- Gesture ownership tests use controlled clocks to exercise expiry, reacquisition, missing releases, multi-touch, and stale disposal.
- Keyboard-focus and viewport tests verify stable text size and pan offsets, safe-area-aware shell placement, focus-free drags, explicit input toggling, and controls that remain under the pointer.
- Close controls use explicit confirmation or one-click closing when confirmation is disabled. Hide is immediate even during momentum; double-tap zoom is not repeated by compatibility mouse events.

### Session and client management

- The Sessions & clients dialog works on empty or detached servers and supports named creation, an optional host directory, optional attachment, inline rename, and attachment of existing sessions.
- Client filtering clears hidden selections. Confirmed detachment carries explicit client identities; the shared dock client is protected and stale identities are rejected. Native tests confirm sessions and unselected clients stay alive.
- Tests cover request correlation, duplicate/stale replies, pending states, retained form errors, partial-detach reconciliation, disconnect/timeout/unload, and no automatic mutation replay after reconnect.
- Desktop/mobile browser coverage includes modal bounds, reduced viewport height, focus restoration, Escape isolation, and scrolling with actions remaining available.

## Upgrade and device checks

After installing the release, restart the existing DSH Web process to load server and vendor-dependency changes, then refresh browser tabs to load the client. A browser refresh alone can still receive host-cached xterm assets after a dependency upgrade. Updating only the browser source in a development checkout requires a refresh unless the matching client build watcher is running.

Headless Chromium/WebKit cannot summon an actual iOS or Android software keyboard. Viewport changes and focus are tested, but OS keyboard animation and browser chrome still need physical-device testing:

1. Open a synthetic session with multiple unzoomed panes. Pan in both directions while output streams; the conversation underneath should remain stationary.
2. Drag a divider grip horizontally and vertically, repeatedly and with the keyboard open. Only the intended pane boundary should resize; dragging inside the terminal should still scroll.
3. Drag a title onto another pane and cancel a second drag. Expect one swap followed by no change, without opening the keyboard.
4. Open and close the keyboard while reading history and while at the live prompt. Check stable text size, preserved reading position, and expected bottom pinning through address-bar movement and rotation.
5. With input focused, drag in another pane without changing focus, then tap it to change the typing target. Verify title close controls stay under the finger.
6. Scroll the toolbar sideways without activating its buttons. Double-tap a title and verify exactly one native zoom toggle.
7. Hide during momentum, then reopen. Expect immediate dismissal, released page scroll lock, and working gestures after reopening.
