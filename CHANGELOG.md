# Changelog

All notable changes to dsh-tmux-cc are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-08-29

### Added

- Settings → tmux now exposes dock position, preferred terminal font size, cursor style and blinking, bounded scrollback depth, pane-close confirmation, and a local reset action alongside the existing font controls.
- A durable host-wide sizing policy can be set to **Auto** or **Mirror only**. Mirror-only keeps `ignore-size` even when no other sizing client is attached; the plugin configuration may provide the composition default.
- Reconnect history depth follows the browser's scrollback setting (2,000 lines by default, capped at 20,000 lines and 800 KB per pane).

### Changed

- Dock geometry, appearance, scrollback, close confirmation, and preferred session are versioned browser-local preferences. They are no longer broadcast between devices or overwritten by host startup defaults.
- History capture is request- and socket-scoped. One browser changing depth or reconnecting no longer resets every other viewer's panes.
- Pane close buttons, the toolbar action, and `Ctrl+B x` now share one confirmation policy; confirmation is enabled by default and requires repeating the same action within three seconds.
- Preferred font size participates in takeover grid measurement and is a ceiling for mirror-mode fitting; existing panes update font, cursor, and scrollback options live.

### Fixed

- Legacy or malformed local preference keys are explicitly normalized and unknown fields are discarded during migration.
- A browser's local font availability and dock dimensions can no longer leak into another browser through the shared tmux runtime.
- Sizing now verifies external viewers immediately before every takeover write, fails closed on detection errors, retries transient policy writes, and reapplies surviving browser votes after detach or session switches.
- Capture requests are globally serialized and coalesced per browser; history is installed before trailing live output from the same control chunk, avoiding lost output and unbounded command queues.
- An xterm load that resolves after a pane was replaced no longer mounts into the detached pane record.

## [0.5.4] - 2026-08-26

### Added

- Mobile toolbar keyboard toggle: the on-screen keyboard is summoned and dismissed explicitly instead of popping up whenever a pane is tapped. The button mirrors real terminal focus via `aria-pressed`.

### Changed

- Kill-pane confirmation is now pointer-aware: mouse clicks kill on the first click again, while touch and pen input keep the two-tap arm-then-confirm guard. The desktop close buttons no longer demand a double click.
- Narrow (mobile) viewports no longer report a dock grid to the host, so a phone can never resize the shared tmux window. This removes the keyboard-open/URL-bar resize→re-render loop that made mobile nearly unusable, and stops a phone from shrinking every other viewer through the min-size rule. Mobile is a faithful mirror that scales fonts to fit.
- Touch scrollback now follows the finger in the natural direction (drag down reveals older lines — it was inverted) and continues with momentum after release.

### Fixed

- Pane selection and layout notifications no longer re-run a non-convergent font/line-height fit. Terminal fitting now uses one cached, font-size-only step, eliminating the two-state whole-grid resize cycle visible after clicks.
- Resize observation is animation-frame coalesced and no longer writes inline margins back onto the observed DSH column. Layout space is composed through plugin-owned CSS variables and markers instead.
- Right docking now composes with dsh-better-sidebar: the tmux dock sits to the left of its panel, shares the remaining width without crushing chat, and additive bottom pushes no longer leave stale chat margins after either panel collapses.
- Closing the dock or entering mobile mode retracts that browser's tmux sizing vote; plugin teardown also closes its WebSocket, preventing stale/ghost viewers from continuing to resize the shared tmux window after HMR.
- Touch scrolling no longer fights the browser: terminal hosts opt out of native panning (`touch-action: none`), so iOS cannot capture the gesture into a visual-viewport pan — which also makes scrolling work while the on-screen keyboard is open.
- Repaints are held while a touch-scroll gesture is active (with an auto-expiring guard), so a snapshot arriving mid-drag no longer re-fits fonts and jiggles the pane under the finger.
- Re-seeding a terminal (reconnect, window switch) preserves how far the reader had scrolled up instead of yanking the viewport to the bottom.
- Sub-2px `visualViewport` inset jitter (URL-bar settling, scroll rounding) no longer repositions the mobile shell, removing a persistent source of resize flashes while scrolling.

## [0.5.3] - 2026-08-26

### Fixed

- Pane fitting now accounts for xterm rounding each row up to whole device pixels: a line height that "exactly" filled a pane could still clip the last terminal row, cutting the bottom frame line of full-screen TUIs in mirror mode. The fitter steps the font down until the integer-rounded grid provably fits.

## [0.5.2] - 2026-08-26

### Added

- Terminal panes prefer system monospace fonts installed on the viewing machine (Berkeley Mono and common Nerd Font cuts first). Settings → tmux can override the CSS `font-family` stack, list local fonts in Chromium, and optionally apply the same stack to DSH's `--ds-font-family-code`.

### Changed

- The launcher trigger is now a floating button in the bottom-right corner, clearing the top-right header cluster used by other plugins.
- Kill-pane from pointer controls (toolbar button, per-pane close) now arms first and confirms on a second tap within 3 seconds; keyboard-prefix kills stay instant.
- Pane toolbar actions (split, zoom, kill) are disabled while detached instead of failing silently.
- A single tmux window no longer renders a one-tab window strip, reclaiming a toolbar row on mobile.
- The Settings section now shows live attach state, session, pane count, and sizing mode, plus a shortcut reference and a styled open/hide button.
- Active pane focus now uses the interactive accent color, and the active pane title brightens.
- The dock sits below DSH's dialog overlay layer, so modals cover and intercept it.

### Removed

- The "Keep across chats" pin toggle: the dock is always persistent and the flag had no behavior attached.

### Fixed

- Multiple connected browsers no longer fight over the shared tmux window: every viewer reports its dock grid and takeover follows tmux's own multi-client rule, sizing the window to the smallest reporting viewer (min cols, min rows), recomputed when a viewer disconnects. A phone opening the dock previously kept resetting the desktop's window and vice versa.
- Terminal panes now scroll on touch devices: a one-finger vertical drag moves through scrollback unless the pane program has mouse reporting enabled, in which case the drag is left to the program.
- Pane terminals no longer show a permanent scrollbar column stealing narrow columns; wheel and touch scrolling are unchanged.
- Terminals follow live theme changes; switching between light and dark no longer leaves xterm rendering with stale colors.
- Detach no longer fights the auto-attach retry and immediately re-attaches; a manual detach now sticks until the user attaches again.
- The right-side dock toolbar no longer overflows at the minimum width: Close moved to the top row and is always reachable, and the actions row scrolls horizontally when narrow.
- Dock size is persisted unclamped, so visiting from a small screen no longer shrinks the restored size on larger screens.
- Font fitting quantizes down instead of rounding, ending clipped first/last terminal lines; the grid probe row height now matches xterm's ~1.2x native row, reducing vertical letterboxing.
- Escape hides the dock when the last interaction was inside it, without stealing Escape from terminal programs or open dropdowns.
- Dock and pane resize handles now have a visible pill affordance and `touch-action: none`.
- Session and dock-side selects are styled with borders and a real chevron instead of a bare native control.
- Toolbar buttons and the launcher expose `aria-label`s, and focus rings use the interactive accent.

## [0.5.1]

### Fixed

- Pane visual boxes now absorb tmux's excluded one-cell right/bottom separators, eliminating gaps and making adjacent desktop and mobile borders meet exactly.
- Desktop resize sashes now center on the corrected pane boundaries and span the complete shared edge.
- Revalidated toolbar control alignment and replaced the affected screenshots with contiguous-grid captures.

## [0.5.0]

### Changed

- Removed the client-side mobile pane tabs and single-pane rendering mode; mobile now preserves the complete native tmux pane grid.
- Pane zoom now uses tmux's normal `resize-pane -Z` toggle from the toolbar, `Ctrl+B z`, or a double-clicked pane title.
- Reduced the mobile toolbar to three rows so the tmux grid receives more vertical space.
- Replaced every public screenshot with visually reviewed synthetic captures, including separate mobile grid and native-zoom states.

### Fixed

- Snapshot parsing now uses `window_visible_layout` and `window_zoomed_flag`, filtering tmux's hidden pre-zoom panes so a natively zoomed pane occupies the exact full cockpit body.
- The zoom button now exposes and displays the real tmux zoom state.

## [0.4.1]

### Fixed

- Mobile pane switching now overrides the pane's inline desktop `left`/`top` geometry, so every selected pane fills the complete cockpit body instead of remaining offset to its tmux grid position.

## [0.4.0]

### Added

- Responsive full-screen mobile cockpit below 768px.
- Touch-friendly window and pane tabs with a single readable active-pane view.
- Safe-area and on-screen keyboard handling through `visualViewport`.
- Privacy-safe desktop and mobile screenshots generated from an isolated synthetic DSH/tmux environment.
- Standard `dsh-plugin` ecosystem metadata, repository topics, and issue labels.

### Changed

- Mobile drawers no longer push the DSH conversation layout or expose desktop resize controls.
- Package assets now include the README screenshots.

### Fixed

- Prevented an asynchronous tmux stdin `EPIPE` from crashing DSH when shutdown races the detach handshake.

## [0.3.0]

### Added

- Automatic mirror/takeover sizing based on other attached tmux clients.
- Window tabs, pane resizing, named layout launchers, and synchronized dock preferences.
- English and Simplified Chinese UI and documentation.

### Security

- Added trusted-host and same-origin route checks, mandatory WebSocket Origin validation, request size limits, and tmux target validation.

## [0.2.0]

### Changed

- Replaced the PTY-based transport with `tmux -C` over plain pipes.
- Switched input to byte-safe, hex-encoded `send-keys -H` commands.
- Paired control replies by tmux block tags and added command timeouts.

[Unreleased]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/adrianleb/dsh-tmux-cc/releases/tag/v0.3.0
[0.2.0]: https://github.com/adrianleb/dsh-tmux-cc/releases/tag/v0.2.0
