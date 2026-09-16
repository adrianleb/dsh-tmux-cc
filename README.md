# dsh-tmux-cc

[简体中文](./README.zh-CN.md) · English

A persistent **tmux control-mode cockpit** for DeepSeek Harness Web. Create sessions or attach to existing ones with `tmux -C`, manage attached clients, render every pane with xterm.js, and keep the dock visible when you switch chats.

[![CI](https://github.com/adrianleb/dsh-tmux-cc/actions/workflows/ci.yml/badge.svg)](https://github.com/adrianleb/dsh-tmux-cc/actions/workflows/ci.yml)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-5a67d8)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> tmux owns the processes and layout; this plugin is only another view. It does not run tmux inside a browser terminal and does not require a PTY or native Node.js addon.

## Preview

<p align="center">
  <img src="./assets/dsh-tmux-cc-desktop.png" alt="dsh-tmux-cc desktop cockpit showing btop, Claude Code, Codex, a CI log, omp, and a README card side by side" width="49%" />
  <img src="./assets/dsh-tmux-cc-desktop-right.png" alt="dsh-tmux-cc as a right sidebar with Claude Code, Codex, and omp stacked" width="49%" />
  <br /><sub>Desktop: bottom dock with six live panes — btop, Claude Code, Codex, a rolling CI log, omp, and a project README — mirrored without stealing window size (left); right-sidebar mode with three coding CLIs stacked (right).</sub>
</p>

<p align="center">
  <img src="./assets/dsh-tmux-cc-mobile.png" alt="dsh-tmux-cc mobile cockpit preserving the complete four-pane tmux grid" width="300" />
  &nbsp;&nbsp;
  <img src="./assets/dsh-tmux-cc-mobile-zoom.png" alt="dsh-tmux-cc mobile cockpit after native tmux pane zoom" width="300" />
  <br /><sub>Mobile: the full-screen drawer preserves the real four-pane tmux grid (left); native <code>resize-pane -Z</code> zoom on the Metrics pane (right).</sub>
</p>

> [!NOTE]
> All screenshots were generated from an isolated DSH profile and a dedicated tmux server containing synthetic demo data only. No prompts were ever sent to the agent CLIs shown; they sit at their welcome screens. Nothing pictured contains private conversations, workspaces, or terminal output.

## Features

- **Persistent across chats** — the dock belongs to the DSH Web shell, not one conversation.
- **Native tmux panes** — pane layout, window tabs, focus, zoom, splits, and resizing stay synchronized with tmux.
- **Non-disruptive sizing** — mirror mode uses `ignore-size` while another terminal is attached; takeover mode provides a crisp 1:1 grid when the dock is the only sizing client.
- **Safe input transport** — input is forwarded byte-for-byte through hex-encoded `send-keys -H`, including Enter, paste, and Unicode.
- **Session management** — create sessions with an optional starting directory, rename or attach existing sessions, switch windows, or launch an optional named session recipe.
- **Attached-client management** — inspect all native clients on the configured tmux server, filter by session, and safely detach selected clients without stopping their processes.
- **Faithful mobile cockpit** — below 768px the dock becomes a full-screen drawer that preserves the real tmux pane grid and native pane zoom, keeps fonts at a readable floor with touch panning across the grid, and never lets the page scroll underneath it.
- **Bilingual UI** — English and Simplified Chinese follow the DSH locale.
- **No native dependencies** — the control channel uses plain stdin/stdout pipes.

## Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) with a Web profile
- Node.js 22 or newer
- pnpm (Corepack is recommended)
- tmux installed on the same host as DSH (tested with tmux 3.4 and 3.7b)
- Linux or macOS

## Install

**v0.7.1 is a GitHub-only release.** Install its prebuilt package:

```bash
dsh plugin --profile web add https://github.com/adrianleb/dsh-tmux-cc/releases/download/v0.7.1/dsh-tmux-cc-0.7.1.tgz
```

The npm channel remains at v0.6.0:

```bash
dsh plugin --profile web add dsh-tmux-cc
```

From the GitHub source:

```bash
dsh plugin --profile web add github:adrianleb/dsh-tmux-cc
```

Or from a local clone:

```bash
git clone https://github.com/adrianleb/dsh-tmux-cc.git
cd dsh-tmux-cc

corepack enable
pnpm install
pnpm run check

dsh plugin --profile web add "$PWD"
```

Restart the existing `dsh web` process, then hard-refresh the Web GUI. A **tmux** button will appear in the bottom-right corner; **Settings → tmux** shows the dock's live state and another way to open it.

To update:

```bash
cd dsh-tmux-cc
git pull --ff-only
pnpm install
pnpm run check
# Restart dsh web, then refresh the browser.
```

## Usage

1. Open the tmux dock.
2. Choose a live tmux session from the dropdown. The plug button detaches or reattaches.
3. Click a pane to focus it and type normally.
4. With focus inside a pane, use the safe prefix and macOS shortcuts below.
5. Drag a pane's title onto another pane to swap their positions (desktop or mobile). Drag the dividers between panes to resize with a mouse or finger in either direction. The outer dock edge is resizable on desktop only; use the tabs to switch tmux windows.

The plugin refuses to kill the final pane in a session.

### Sessions & clients

Open **Sessions & clients** from the dock toolbar (the grid/plus icon). It works even when the dock is detached or no sessions exist.

- **Create session:** enter a unique name and optionally an existing absolute directory on the DSH host. The new session starts the host's default shell; leave **Attach after creating** unchecked to keep it detached. Names may contain spaces or Unicode, but not dots, colons, semicolons, or control characters (maximum 200 characters). Names that would shadow a configured recipe ID for a different session are reserved.
- **Sessions:** see window/client counts, attach, or rename a session inline. Attaching switches the shared dock for every browser viewer. Rename does not restart processes.
- **Attached clients:** see native client names, session, PID, terminal/TTY, size, flags, and connection time across the configured tmux server—not other tmux sockets. Browser tabs share one control client and are not separate entries.
- Filter by session, select individual clients or **Select all**, then choose **Detach selected** and confirm the listed targets. Changing the filter clears selection. The host checks each client's name, PID, and creation time so a stale selection cannot silently target a replacement client.
- **This dock (shared)** is listed but cannot be bulk-detached. Use the dock's existing **Detach** button to disconnect its shared control client. Detaching never kills sessions or their running processes; there is deliberately no kill-session or kill-server button.

The manager refreshes every five seconds while visible and idle; **Refresh** reloads immediately. Errors stay visible without clearing form input. If a connection drops or a request times out, refresh before retrying: the operation may already have completed and mutations are never automatically replayed. **Done** or `Escape` closes the manager.

## Keyboard shortcuts

Shortcut interception is active only while an xterm pane has focus; dock controls, the DSH composer, and the rest of the browser keep their normal keys.

### Prefix map (all platforms)

Press `Ctrl+B`, then:

| Key | Action |
| --- | --- |
| Arrow | Select the pane in that direction |
| `c` | Create a tmux window |
| `n` / `p` | Select the next / previous tmux window |
| `0`–`9` | Select the tmux window with that index |
| `x` | Close the active pane, using the configured confirmation policy |
| `z` | Toggle native tmux zoom |
| `d` | Detach |
| `"` / `%` | Split top/bottom / side-by-side |
| `Ctrl+B` | Send a literal `Ctrl+B` to the active pane |

A pending prefix expires after 1.5 seconds and is then forwarded literally. Unsupported follow-ups also forward the pending `Ctrl+B` before passing the follow-up to xterm.

### iTerm2-compatible macOS map

The following exact iTerm2 menu chords do not overlap DSH or documented Chrome shortcuts, so the plugin adapts them while an xterm is focused:

| Shortcut | Action in this plugin |
| --- | --- |
| `⌃⇧⌘D` | Detach |
| `⌃⇧⌘N` / `⌃⇧⌘T` | Create a tmux window (shown as a dock tab) |
| `⌥⇧⌘N` / `⌥⇧⌘T` | Create a tmux window, adapting iTerm2's current-profile variants |
| `⌥⌘X` | Close the focused pane using the configured confirmation policy |
| `⇧⌘Return` | Toggle native tmux zoom |
| `⌃⌘Arrow` | Resize the active pane one cell in that direction |
| `⌥⇧⌘H` / `⌥⇧⌘V` | Split top/bottom / side-by-side |

For a more comfortable optional pair, enable **Compact split shortcuts** under **Settings → tmux → Behavior & safety**: `⌥⌘D` splits side-by-side and `⌥⇧⌘D` splits top/bottom. This is off by default and stored per browser because some macOS configurations reserve `⌥⌘D` for showing or hiding the Dock; a chord intercepted by macOS cannot reach the page.

Browser-reserved iTerm2 defaults are intentionally **not** intercepted: `⌘D` and `⇧⌘D` bookmark pages/tabs; `⌘W` and modifier variants can close a browser tab or window; `⌘[`/`⌘]` navigate history; and `⌥⌘Arrow` switches browser tabs. Pause Pane and Dashboard have no matching dock operation. See the [official iTerm2 tmux integration documentation](https://iterm2.com/documentation-tmux-integration.html).

## Mobile

At viewport widths below 768px, the cockpit follows the narrow-layout pattern established by dsh-better-sidebar:

- The dock becomes a full-screen floating drawer sized to the **visual viewport** and stops pushing the DSH conversation layout. While it is open the page behind it is scroll-locked, and the un-cancellable browser-level panning that iOS performs with the keyboard open is tracked exactly, so the conversation underneath can never scroll or peek through.
- Every tmux pane stays visible in its real tmux grid position; there is no separate client-side pane-tab or single-pane mode.
- Text stays at the mobile toolbar's chosen size (12px by default), including while the keyboard opens and closes. A grid larger than its pane box becomes pannable: one-finger drags move it in either axis with momentum. Reading offsets are preserved; the prompt stays bottom-pinned until you pan or scroll away.
- Drag a pane title onto another pane to swap their native tmux positions. Terminal-content drags only scroll; they never move a pane or change keyboard focus.
- Vertical drags scroll every kind of pane content. Beyond the clipped grid rows, the gesture becomes synthetic wheel events that xterm interprets per pane state: programs with mouse reporting (agent CLIs, TUIs) receive real wheel reports and scroll their own transcripts, alternate-screen programs get arrow keys, and normal buffers scroll xterm scrollback.
- Tap a pane to select it, then use the toolbar zoom button or `Ctrl+B z`. This sends tmux's native `resize-pane -Z`; tapping it again restores the grid. Double-tapping (or double-clicking) a pane title performs the same native toggle.
- Tapping a pane never opens the on-screen keyboard. The toolbar keyboard button summons and dismisses it explicitly, so scrolling and reading stay undisturbed. While the keyboard is up, the session picker and window-tab rows collapse to give the terminal the space back, and focus follows pane taps so typing goes where you touched.
- A narrow viewport is a pure mirror: it retracts any grid previously reported by that browser and never resizes the shared tmux window, so the keyboard opening or the URL bar collapsing cannot reflow other viewers or trigger refresh loops.
- Drag the visible grips on pane boundaries to resize horizontally or vertically. Divider hit areas are 24px wide on phones and touch-capable devices; dragging terminal content still only scrolls. Only the outer full-screen dock resize handle and desktop side selector are hidden; primary controls use 44px touch targets.
- Safe-area padding supports notched devices, while `visualViewport` resize/scroll tracking keeps the terminal above the on-screen keyboard.
- At 768px and wider, the complete desktop layout and resize controls return automatically.

## Sizing model

The mode changes automatically and is re-evaluated every five seconds:

- **Mirror** — another sizing client is attached, such as a normal `tmux attach` or iTerm2 `-CC` client. The dock keeps `ignore-size`, never changes that client's geometry, renders each pane at its real cell size, and scales the font to fit (on mobile only down to the readable floor; beyond that the grid pans).
- **Takeover** — only `ignore-size` clients are present. The dock reports its available grid with `refresh-client -C` and renders at the native font size. Only desktop-width viewers report a grid; mobile viewers always mirror.

Opening another tmux client moves the dock back to mirror mode; closing it returns the dock to takeover mode when the host-wide policy is **Auto**. Choose **Mirror only** in **Settings → tmux → Behavior & safety** if this plugin should never resize tmux windows. Mobile viewers remain mirror-only under either policy.

## Settings

**Settings → tmux** separates browser-local presentation from the one behavior shared by the host:

- **Dock:** bottom/right placement, open/hide, and reset-to-defaults.
- **Terminal:** font family, preferred size, cursor style/blinking, scrollback depth, and optional DSH code-font propagation. Mirror mode may shrink below the preferred font size to preserve the real grid.
- **Behavior & safety:** durable host-wide **Auto / Mirror only** sizing policy plus browser-local pane-close confirmation and optional compact split shortcuts.

Browser-local settings are versioned in local storage and never broadcast to other viewers. Reset preserves whether the dock is open and the browser's selected session. The sizing policy is registered through DSH's settings service, so a writable loopback settings provider persists it in the normal settings document.

Scrollback defaults to 2,000 lines and is bounded to 20,000 lines and 800 KB per pane. The value controls both xterm retention and tmux history requested after reconnect or a window switch. History replies return only to the browser that requested them; capture work is serialized and repeated pending requests from one browser coalesce to the newest request.

Pane-close confirmation is enabled by default. A single activation opens an explicit confirmation dialog; cancel leaves the pane untouched. Disable confirmation for one-click pane closing. The dock's **Hide** button always works on the first click and never kills a process. The host still refuses to kill the final pane in a session.

### Interaction regression checks

```bash
pnpm run check
pnpm exec playwright install --with-deps chromium webkit
pnpm test:browser
node --experimental-strip-types --test tests/native/*.test.ts
# Optional: verify the existing GUI's installed assets, with mocked tmux transport:
DSH_GUI_URL=http://127.0.0.1:3080 pnpm test:browser
```

Browser tests use real xterm in Chromium and WebKit with synthetic terminals; Chromium also receives trusted CDP touch input. Native tests create and clean up a separate tmux server. `CHROMIUM_PATH` can select an existing Chromium binary. No test sends input to an operator's panes. See [UX verification](./UX-VERIFICATION.md) for coverage and the physical-device keyboard checklist.

## Fonts

tmux-cc renders with **xterm.js in the browser**, so it can only use fonts installed on the computer *viewing* the GUI (or fonts served as `@font-face`). Fonts on the DSH host do not automatically appear in a remote browser.

With an empty font setting, the dock prefers this stack and lets CSS fall through to the first family the browser can resolve:

`Berkeley Mono Nerd Font Mono`, `Berkeley Mono`, `JetBrainsMono Nerd Font Mono`, `FiraCode Nerd Font Mono`, `Hack Nerd Font Mono`, then `ui-monospace`.

If Berkeley Mono is installed, the browser family names are typically `Berkeley Mono` and `Berkeley Mono Nerd Font Mono` (the Nerd cut is better if panes use powerline/nerd glyphs).

Set a custom stack in **Settings → tmux → Terminal font**, for example:

```text
"Berkeley Mono", "Berkeley Mono Nerd Font Mono", ui-monospace, monospace
```

Leave the field empty to keep the default stack. Chromium can also list installed families via the Local Font Access API when you focus the input.

Optionally tick **Also use this font for DSH code** to set `--ds-font-family-code` (and `--dsw-font-mono`) so markdown, tool output, and sidebar terminals that follow the theme monospace pick up the same family. That does not restyle the whole DSH chrome; to change the UI sans-serif as well, inject CSS (dsh-better-sidebar **custom** scheme) such as:

```css
:root {
  --dsw-font-family: "Berkeley Mono", ui-sans-serif, system-ui, sans-serif;
}
```

dsh-better-sidebar also has its own **Terminal font family** field under the side-card terminal settings; that applies only to sidebar PTY tabs, not to this tmux dock.

## Configuration

Add options to the plugin entry in your DSH Web profile:

```yaml
- id: tmux-cc
  name: dsh-tmux-cc
  config:
    # Optional composition default. Settings → tmux can store a user override.
    sizePolicy: auto # auto | mirror

    # Optional. Defaults to $DSH_TMUX_BIN, then `tmux` from PATH.
    tmuxBin: /usr/local/bin/tmux

    # Optional named session recipes.
    layouts:
      - id: project
        label: Project cockpit
        session: project
        launch: /home/me/.local/bin/start-project-tmux
        launchArgs: ["--ensure-only"]
```

`sizePolicy` supplies the deployment default; a value saved through Settings is layered above it. `auto` permits takeover only when no external sizing client exists, while `mirror` always keeps this plugin out of tmux window sizing.

When a recipe's session does not exist, selecting it runs `launch` with `launchArgs` and then attaches. If `launchArgs` is omitted, it defaults to `["--ensure-only"]`. Launcher configuration is trusted administrator input and runs with the DSH operating-system user's privileges. Host executable paths are never sent to the browser.

## Architecture

| Layer | Path | Responsibility |
| --- | --- | --- |
| DSH host plugin | `src/` | HTTP/WebSocket routes, tmux control client, layout and sizing state |
| Browser client | `lib/client.js` | DSH UI slots, dock, xterm.js panes, input and resizing |
| DSH bundle patch | `cordis.patch.yml` | Registers the host plugin in a profile |
| Tests | `src/*.test.ts` | Layout decoding, control protocol, safety, and client bundle invariants |

The host communicates with tmux over line-framed control mode. Command replies are paired using `%begin/%end/%error` tags, every command has a timeout, and unsolicited notifications trigger snapshot refreshes.

## Security

This plugin can send keystrokes to tmux sessions owned by the DSH operating-system user. **Access to the DSH Web port is therefore shell-equivalent for that user's tmux sessions.** The plugin does not add a separate login layer; it relies on DSH's network boundary and trusted-host configuration. Keep DSH loopback-only unless you have deliberately secured remote access.

- HTTP routes enforce loopback/trusted-host checks; WebSocket control additionally requires an allowed `Origin`.
- The browser receives session metadata and terminal output, but not configured launcher paths.
- The plugin never uses `attach -d` and will not steal another attached client.
- No telemetry is collected.

Please report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md).

## Troubleshooting

- **No tmux button:** verify the plugin is in the `web` profile, run `pnpm run build`, restart the existing `dsh web` process, and hard-refresh.
- **No sessions listed:** run `tmux list-sessions` as the same OS user that runs DSH.
- **`tmux` not found:** set `config.tmuxBin` or `DSH_TMUX_BIN` to an absolute path.
- **Remote DSH host rejected:** add the hostname to DSH's trusted-host configuration; do not disable the request fence.
- **Layout launcher fails:** run the configured executable manually as the DSH user and verify that it creates the named session within 20 seconds.

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

`pnpm run check` runs all three validation steps. Contributions are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
