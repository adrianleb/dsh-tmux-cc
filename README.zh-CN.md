# dsh-tmux-cc

简体中文 · [English](./README.md)

一个用于 DeepSeek Harness Web 的持久化 **tmux 控制模式工作台**。它通过 `tmux -C` 连接已有的 tmux 会话，用 xterm.js 渲染每个窗格，并且在切换聊天时始终保持可见。

[![CI](https://github.com/adrianleb/dsh-tmux-cc/actions/workflows/ci.yml/badge.svg)](https://github.com/adrianleb/dsh-tmux-cc/actions/workflows/ci.yml)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-5a67d8)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> 进程和布局仍由 tmux 管理，本插件只是一个新的显示与控制端。它不是“在浏览器终端里运行 tmux”，不需要 PTY，也没有原生 Node.js 扩展依赖。

## 界面预览

<p align="center">
  <img src="./assets/dsh-tmux-cc-desktop.png" alt="dsh-tmux-cc 桌面工作台并排显示 btop、Claude Code、Codex、CI 日志、omp 和 README 卡片" width="49%" />
  <img src="./assets/dsh-tmux-cc-desktop-right.png" alt="dsh-tmux-cc 右侧边栏模式纵向叠放 Claude Code、Codex 和 omp" width="49%" />
  <br /><sub>桌面：底部工作台容纳六个实时窗格（btop、Claude Code、Codex、滚动 CI 日志、omp、项目 README），以镜像模式呈现、不抢占窗口尺寸（左）；右侧边栏模式纵向叠放三个编程 CLI（右）。</sub>
</p>

<p align="center">
  <img src="./assets/dsh-tmux-cc-mobile.png" alt="dsh-tmux-cc 移动工作台保留完整四窗格 tmux 网格" width="300" />
  &nbsp;&nbsp;
  <img src="./assets/dsh-tmux-cc-mobile-zoom.png" alt="dsh-tmux-cc 移动工作台使用原生 tmux 窗格缩放" width="300" />
  <br /><sub>移动端：全屏抽屉保留真实的四窗格 tmux 网格（左）；对 Metrics 窗格使用原生 <code>resize-pane -Z</code> 缩放（右）。</sub>
</p>

> [!NOTE]
> 所有截图均来自完全隔离的 DSH profile 和独立 tmux server。截图中的 agent CLI 均停留在欢迎界面，从未发送任何提示词；画面不包含私人对话、工作区或终端输出。

## 功能特性

- **跨聊天持久显示** —— 工作台属于 DSH Web 外壳，而不是某个对话。
- **原生 tmux 窗格** —— 窗格布局、窗口标签、焦点、缩放、分屏和大小调整都会与 tmux 同步。
- **不干扰其他终端** —— 有其他终端连接时使用 `ignore-size` 镜像模式；只有工作台参与尺寸计算时，自动切换为清晰的 1:1 接管模式。
- **可靠的输入传输** —— 通过十六进制 `send-keys -H` 原样转发输入，包括回车、粘贴和 Unicode。
- **多会话与多窗口** —— 支持连接、断开、切换窗口，以及按需启动可选的命名会话方案。
- **忠于 tmux 的移动工作台** —— 视口小于 768px 时使用全屏抽屉，同时保留真实 tmux 窗格网格和原生窗格缩放。
- **中英文界面** —— 自动跟随 DSH 的语言设置显示英文或简体中文。
- **无原生依赖** —— 控制通道仅使用标准输入/输出管道。

## 环境要求

- 带 Web profile 的 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)
- Node.js 22 或更高版本
- pnpm（推荐通过 Corepack 使用）
- tmux 与 DSH 安装在同一台主机上（已在 tmux 3.7b 验证）
- Linux 或 macOS

## 安装

```bash
git clone https://github.com/adrianleb/dsh-tmux-cc.git
cd dsh-tmux-cc

corepack enable
pnpm install
pnpm run check

dsh plugin --profile web add "$PWD"
```

重启当前的 `dsh web` 进程，然后强制刷新 Web 页面。右下角会出现 **tmux** 悬浮按钮；**设置 → tmux** 中会显示工作台的实时状态，并提供另一个打开入口。

更新方法：

```bash
cd dsh-tmux-cc
git pull --ff-only
pnpm install
pnpm run check
# 重启 dsh web，然后刷新浏览器。
```

## 使用方法

1. 打开 tmux 工作台。
2. 在下拉列表中选择一个正在运行的 tmux 会话；插头按钮用于断开或重新连接。
3. 点击窗格获取焦点，然后正常输入。
4. 窗格获得焦点后，可使用 `Ctrl+B`，再按方向键、`x`、`z`、`"` 或 `%` 执行常用 tmux 操作。
5. 拖动工作台边缘或窗格分隔条调整大小；使用标签切换 tmux 窗口。

为了避免意外终止整个会话，本插件拒绝关闭会话中的最后一个窗格。

## 移动端

视口宽度小于 768px 时，工作台采用 dsh-better-sidebar 已验证的窄屏布局思路：

- 工作台变为全屏浮动抽屉，不再挤压 DSH 对话区域。
- 所有 tmux 窗格仍显示在真实 tmux 网格位置；不再额外引入客户端窗格标签或单窗格模式。
- 点击窗格获取焦点后，使用工具栏缩放按钮或 `Ctrl+B z`；插件会发送 tmux 原生 `resize-pane -Z`，再次操作即可恢复网格。双击窗格标题也执行同一个原生切换。
- 禁用工作台和窗格拖动条，隐藏桌面端方向选择器，主要按钮采用 44px 触控区域。
- 刘海屏通过 safe-area 内边距适配；`visualViewport` 的 resize/scroll 监听会在软键盘弹出时将终端保持在键盘上方。
- 视口达到 768px 后，会自动恢复完整的桌面布局和尺寸调整功能。

## 尺寸策略

插件每五秒自动检查一次，并在以下两种模式间切换：

- **镜像（Mirror）** —— 存在普通 `tmux attach` 或 iTerm2 `-CC` 等其他尺寸客户端。工作台保持 `ignore-size`，不会改变其他客户端的终端尺寸；每个窗格按真实字符网格渲染，再缩放字体以适应工作台。
- **接管（Takeover）** —— 当前只有 `ignore-size` 客户端。工作台通过 `refresh-client -C` 上报可用网格，并按原生字体大小渲染。

打开其他 tmux 客户端后，工作台会退回镜像模式；关闭后则恢复接管模式。

## 字体

tmux-cc 用浏览器里的 **xterm.js** 绘制，因此只能使用 *正在浏览 GUI 的那台电脑* 上已安装的字体（或通过 `@font-face` 下发的字体）。DSH 主机上的字体不会自动出现在远程浏览器中。

字体设置为空时，工作台会按下面的栈回退，浏览器会选用它能解析的第一个家族：

`Berkeley Mono Nerd Font Mono`、`Berkeley Mono`、`JetBrainsMono Nerd Font Mono`、`FiraCode Nerd Font Mono`、`Hack Nerd Font Mono`，然后是 `ui-monospace`。

若已安装 Berkeley Mono，浏览器里的家族名通常是 `Berkeley Mono` 和 `Berkeley Mono Nerd Font Mono`（窗格里如果有 nerd/powerline 符号，Nerd 版本更合适）。

可在 **设置 → tmux → 终端字体** 填写自定义栈，例如：

```text
"Berkeley Mono", "Berkeley Mono Nerd Font Mono", ui-monospace, monospace
```

留空则继续用默认栈。在 Chromium 中，聚焦输入框时还可以通过 Local Font Access API 列出本机字体。

可选勾选 **同时用于 DSH 代码字体**，以设置 `--ds-font-family-code`（以及 `--dsw-font-mono`），让 Markdown、工具输出、以及跟随主题等宽字体的侧栏终端使用同一字体。这不会改掉整个 DSH 界面；若也要改 UI 无衬线字体，可通过 dsh-better-sidebar 的 **自定义** 方案注入：

```css
:root {
  --dsw-font-family: "Berkeley Mono", ui-sans-serif, system-ui, sans-serif;
}
```

dsh-better-sidebar 侧栏终端设置里还有单独的 **终端字体** 项，只作用于侧栏 PTY 标签，不会影响本 tmux 工作台。

## 配置

在 DSH Web profile 的插件配置中添加选项：

```yaml
- id: tmux-cc
  name: dsh-tmux-cc
  config:
    # 可选。默认依次使用 $DSH_TMUX_BIN 和 PATH 中的 `tmux`。
    tmuxBin: /usr/local/bin/tmux

    # 可选的命名会话方案。
    layouts:
      - id: project
        label: 项目工作台
        session: project
        launch: /home/me/.local/bin/start-project-tmux
        launchArgs: ["--ensure-only"]
```

如果方案对应的会话不存在，选择该方案时会先执行 `launch` 和 `launchArgs`，然后连接。如果省略 `launchArgs`，默认值为 `["--ensure-only"]`。启动器配置属于受信任的管理员输入，并会以运行 DSH 的操作系统用户权限执行。主机上的可执行文件路径不会发送给浏览器。

## 项目结构

| 层 | 路径 | 职责 |
| --- | --- | --- |
| DSH 主机插件 | `src/` | HTTP/WebSocket 路由、tmux 控制客户端、布局与尺寸状态 |
| 浏览器客户端 | `lib/client.js` | DSH UI 插槽、工作台、xterm.js 窗格、输入与尺寸调整 |
| DSH bundle 补丁 | `cordis.patch.yml` | 在 profile 中注册主机插件 |
| 测试 | `src/*.test.ts` | 布局解码、控制协议、安全策略和客户端 bundle 约束 |

主机通过按行分帧的控制模式与 tmux 通信。命令回复使用 `%begin/%end/%error` 标签配对；每个命令都有超时保护；tmux 的主动通知会触发状态刷新。

## 安全说明

本插件可以向 DSH 操作系统用户拥有的 tmux 会话发送按键。因此，**能够访问 DSH Web 端口，就相当于能够控制该用户的 tmux 会话并执行 Shell 操作。** 插件不会增加独立登录层，而是依赖 DSH 的网络边界和 trusted-host 配置。除非你已主动保护远程访问，否则请仅监听本机回环地址。

- HTTP 路由会检查本机/可信主机；WebSocket 控制还必须提供允许的 `Origin`。
- 浏览器可以获取会话元数据和终端输出，但无法获取配置的启动器路径。
- 插件不会使用 `attach -d`，因此不会抢占其他已连接客户端。
- 本项目不收集遥测数据。

如需报告安全漏洞，请按照 [SECURITY.md](./SECURITY.md) 中的方式私下联系维护者。

## 常见问题

- **没有 tmux 按钮：** 确认插件已加入 `web` profile，运行 `pnpm run build`，重启当前 `dsh web` 进程并强制刷新页面。
- **没有会话：** 使用运行 DSH 的同一个操作系统用户执行 `tmux list-sessions`。
- **找不到 `tmux`：** 将 `config.tmuxBin` 或 `DSH_TMUX_BIN` 设置为绝对路径。
- **远程 DSH 主机请求被拒绝：** 将主机名加入 DSH 的 trusted-host 配置；不要关闭请求安全检查。
- **会话启动器失败：** 以 DSH 用户身份手动运行配置的程序，并确认它能在 20 秒内创建指定会话。

## 开发

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

`pnpm run check` 会依次执行以上三个检查。欢迎参与贡献，详情请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
