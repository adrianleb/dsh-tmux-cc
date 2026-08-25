# Changelog

All notable changes to dsh-tmux-cc are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/adrianleb/dsh-tmux-cc/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/adrianleb/dsh-tmux-cc/releases/tag/v0.3.0
[0.2.0]: https://github.com/adrianleb/dsh-tmux-cc/releases/tag/v0.2.0
