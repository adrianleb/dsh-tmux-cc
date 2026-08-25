# Security Policy / 安全策略

## Supported versions / 支持版本

Security fixes are provided for the latest release on the `main` branch.

安全修复以 `main` 分支上的最新版本为准。

| Version | Supported |
| --- | --- |
| 0.3.x | Yes |
| < 0.3 | No |

## Reporting a vulnerability / 报告漏洞

Please do **not** open a public issue or discussion containing vulnerability details.

请**不要**在公开 Issue 或 Discussion 中披露漏洞详情。

Use GitHub's private vulnerability reporting page:

请使用 GitHub 私有漏洞报告页面：

<https://github.com/adrianleb/dsh-tmux-cc/security/advisories/new>

Include the affected version, environment, reproduction steps, impact, and any suggested mitigation. You should receive an acknowledgement within seven days. Please allow time for a fix before public disclosure.

请提供受影响版本、运行环境、复现步骤、影响范围和可选的缓解建议。维护者会尽量在七天内确认收到报告；公开披露前请预留修复时间。

## Security scope / 安全边界

The plugin intentionally exposes terminal input and output for tmux sessions owned by the DSH operating-system user. WebSocket control is browser-oriented and requires an allowed `Origin`; non-browser clients without that header are rejected. Reports about bypassing the trusted-host/origin fence, unauthorized session access, command injection outside intended terminal input, or leaking configured host paths are in scope.

本插件会按设计暴露 DSH 操作系统用户所拥有 tmux 会话的输入与输出。以下问题属于安全范围：绕过 trusted-host/同源检查、未授权会话访问、预期终端输入之外的命令注入，以及泄露主机配置路径。
