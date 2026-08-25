# dsh-tmux-cc

[简体中文](./README.zh-CN.md) · English

A persistent **tmux control-mode cockpit** for DeepSeek Harness Web. It attaches to an existing tmux session with `tmux -C`, renders every pane with xterm.js, and stays visible when you switch chats.

[![CI](https://github.com/adrianleb/dsh-tmux-cc/actions/workflows/ci.yml/badge.svg)](https://github.com/adrianleb/dsh-tmux-cc/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> tmux owns the processes and layout; this plugin is only another view. It does not run tmux inside a browser terminal and does not require a PTY or native Node.js addon.

## Features

- **Persistent across chats** — the dock belongs to the DSH Web shell, not one conversation.
- **Native tmux panes** — pane layout, window tabs, focus, zoom, splits, and resizing stay synchronized with tmux.
- **Non-disruptive sizing** — mirror mode uses `ignore-size` while another terminal is attached; takeover mode provides a crisp 1:1 grid when the dock is the only sizing client.
- **Safe input transport** — input is forwarded byte-for-byte through hex-encoded `send-keys -H`, including Enter, paste, and Unicode.
- **Multiple sessions and windows** — attach, detach, switch windows, or launch an optional named session recipe.
- **Bilingual UI** — English and Simplified Chinese follow the DSH locale.
- **No native dependencies** — the control channel uses plain stdin/stdout pipes.

## Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) with a Web profile
- Node.js 22 or newer
- pnpm (Corepack is recommended)
- tmux installed on the same host as DSH (tested with tmux 3.7b)
- Linux or macOS

## Install

```bash
git clone https://github.com/adrianleb/dsh-tmux-cc.git
cd dsh-tmux-cc

corepack enable
pnpm install
pnpm run check

dsh plugin --profile web add "$PWD"
```

Restart the existing `dsh web` process, then hard-refresh the Web GUI. A **tmux** button will appear in the upper-right corner; **Settings → tmux** provides a short description and another way to open the dock.

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
4. With focus inside a pane, use `Ctrl+B` followed by arrows, `x`, `z`, `"`, or `%` for common tmux actions.
5. Drag the dock edge or pane sashes to resize; use the tabs to switch tmux windows.

The plugin refuses to kill the final pane in a session.

## Sizing model

The mode changes automatically and is re-evaluated every five seconds:

- **Mirror** — another sizing client is attached, such as a normal `tmux attach` or iTerm2 `-CC` client. The dock keeps `ignore-size`, never changes that client's geometry, renders each pane at its real cell size, and scales the font to fit.
- **Takeover** — only `ignore-size` clients are present. The dock reports its available grid with `refresh-client -C` and renders at the native font size.

Opening another tmux client moves the dock back to mirror mode; closing it returns the dock to takeover mode.

## Configuration

Add options to the plugin entry in your DSH Web profile:

```yaml
- id: tmux-cc
  name: dsh-tmux-cc
  config:
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
