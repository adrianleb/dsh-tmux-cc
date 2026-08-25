# Contributing / 参与贡献

Thank you for helping improve dsh-tmux-cc. Bug reports, documentation fixes, tests, and focused pull requests are welcome.

感谢你帮助改进 dsh-tmux-cc。欢迎提交问题报告、文档修正、测试和目标明确的 Pull Request。

## Development setup / 开发环境

Requirements: Node.js 22+, pnpm, tmux, and a local DeepSeek Harness Web profile.

环境要求：Node.js 22+、pnpm、tmux，以及本地 DeepSeek Harness Web profile。

```bash
git clone https://github.com/adrianleb/dsh-tmux-cc.git
cd dsh-tmux-cc
corepack enable
pnpm install
pnpm run check
```

## Project conventions / 项目约定

- Keep host code in `src/` and browser code in `lib/client.js`.
- Add or update tests for behavior changes.
- Keep the English and Chinese READMEs aligned when changing user-facing behavior.
- Do not commit `node_modules`, `dist`, credentials, private paths, tmux output, or local DSH profile files.
- Keep changes focused; avoid unrelated formatting or dependency upgrades.

- 主机端代码放在 `src/`，浏览器端代码放在 `lib/client.js`。
- 行为变更需要新增或更新测试。
- 修改用户可见行为时，请同步更新中英文 README。
- 不要提交 `node_modules`、`dist`、凭据、私有路径、tmux 输出或本地 DSH profile 文件。
- 每次改动应保持目标明确，避免无关的格式调整或依赖升级。

## Before opening a pull request / 提交 PR 前

```bash
pnpm run check
pnpm pack --dry-run
```

Confirm that the package contains `dist/`, `lib/client.js`, both READMEs, the bundle patch, and the license. If your change affects the UI, test it in the existing DSH Web server after rebuilding and refreshing the page.

请确认打包结果包含 `dist/`、`lib/client.js`、两份 README、bundle 补丁和许可证。如果改动影响界面，请重新构建，并在现有 DSH Web 服务中刷新页面后测试。

## Reporting security issues / 报告安全问题

Do not open a public issue for a vulnerability. Follow [SECURITY.md](./SECURITY.md).

请勿公开提交漏洞详情，请按照 [SECURITY.md](./SECURITY.md) 私下报告。
