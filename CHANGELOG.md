# Changelog

All notable changes to dsh-tmux-cc are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/adrianleb/dsh-tmux-cc/releases/tag/v0.3.0
[0.2.0]: https://github.com/adrianleb/dsh-tmux-cc/releases/tag/v0.2.0
