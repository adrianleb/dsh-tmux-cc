window.__ModuleLoader__.load({
  id: 'dsh-tmux-cc',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const NS = 'tmux-cc'
    const STORE_KEY = 'dsh-tmux-cc:dock'
    const ROOT_ID = 'dsh-tmux-cc-root'
    const STYLE_ID = 'dsh-tmux-cc-style'
    const BUFFER_CAP = 800000
    const PREFS_VERSION = 3
    const MAX_SCROLLBACK_LINES = 20000
    /**
     * Mirror fitting on a phone used to shrink fonts to whatever made the
     * remote tmux grid fit — routinely 5–6px, unreadable. Mobile now stops at
     * a readable floor and lets the true grid overflow its pane box instead;
     * one-finger drags pan across the overflow (and into scrollback).
     */
    const MOBILE_MIN_FONT = 12
    const copy = {
      zh: {
        nav: 'tmux',
        open: '打开 tmux',
        close: '收起',
        attach: '连接',
        detach: '断开',
        zoom: '放大',
        unzoom: '还原窗格',
        splitH: '左右分',
        splitV: '上下分',
        kill: '关闭窗格',
        killConfirm: '关闭此窗格？其中运行的进程将被终止。',
        movePane: '拖动标题交换窗格位置；双击缩放',
        kbd: '键盘',
        fontDown: '缩小终端文字',
        fontUp: '放大终端文字',
        hint: '控制模式座舱，推开对话而不是盖住它。拖分隔条改大小。',
        keys: '窗格快捷键',
        keysHelp: '终端聚焦后：Ctrl+B，再按方向键、c、n/p、0–9、x、z、d、" 或 %。连按两次 Ctrl+B 会向窗格发送原按键。',
        itermKeys: '兼容 iTerm2 的 macOS 快捷键',
        itermKeysHelp: '⌃⇧⌘D 断开；⌃⇧⌘N/T 或 ⌥⇧⌘N/T 新建窗口；⌥⌘X 关闭窗格；⇧⌘↩ 缩放；⌃⌘方向键微调；⌥⇧⌘H/V 分屏。',
        shortcutSafety: '为避免浏览器冲突，不会拦截 iTerm2 的 ⌘D、任何 ⌘W 变体、⌘[/] 或 ⌥⌘方向键。',
        state: '状态',
        attached: '已连接',
        detached: '未连接',
        panes: '窗格',
        notAttached: '选择一个 tmux session 并连接。',
        sessionGone: '该 session 已不存在，请选择其他的。',
        noSessions: '这台机器上没有 tmux session。',
        font: '终端字体',
        fontHelp: 'CSS font-family 栈。留空则优先使用本机已安装的 Berkeley Mono 和其他等宽字体。字体装在浏览这台 GUI 的机器上，而不是 DSH 主机上。',
        fontPlaceholder: '"Berkeley Mono", monospace',
        fontHarness: '同时用于 DSH 代码字体（Markdown、工具输出，以及跟随主题等宽字体的侧栏终端）',
        dock: '停靠栏',
        dockSide: '停靠位置',
        bottom: '底部',
        right: '右侧',
        terminal: '终端',
        fontSize: '首选字号',
        fontSizeHelp: '镜像模式会在必要时缩小字号，以完整显示真实 tmux 网格。',
        cursorStyle: '光标样式',
        cursorBlock: '方块',
        cursorUnderline: '下划线',
        cursorBar: '竖线',
        cursorBlink: '光标闪烁',
        scrollback: '回滚行数',
        scrollbackHelp: '同时控制 xterm 保留量和重新连接时请求的 tmux 历史记录，最多 20,000 行。',
        behavior: '行为与安全',
        sizingPolicy: '窗口尺寸策略',
        sizingAuto: '自动（无其他尺寸客户端时接管）',
        sizingMirror: '仅镜像（永不调整 tmux 窗口）',
        sizingHelp: '此设置由主机共享。移动端仍始终仅镜像。',
        confirmKill: '关闭窗格前要求再次确认',
        compactSplit: '启用紧凑分屏快捷键：⌥⌘D 左右分屏，⌥⇧⌘D 上下分屏',
        compactSplitHelp: '仅保存在此浏览器中。部分 macOS 配置会将 ⌥⌘D 用于显示/隐藏程序坞；如果系统拦截该按键，网页无法覆盖它。',
        reset: '重置本机设置',
        resetHelp: '恢复此浏览器的停靠栏和终端设置；保留打开状态和所选 session。',
        settingsUnavailable: '主机设置在此连接上只读。',
        viewers: '其他尺寸客户端',
        manage: '会话与客户端',
        manageHelp: '管理此 tmux 服务器上的所有会话。连接或断开停靠栏会影响所有浏览器查看者。',
        sessions: '会话',
        clients: '已连接客户端',
        clientHelp: '这是原生 tmux 客户端，不是浏览器标签页。断开连接不会终止会话或其中的进程。',
        createSession: '创建会话',
        sessionName: '会话名称',
        sessionNameHelp: '最多 200 个字符；不支持点、冒号、分号和控制字符。',
        startDirectory: '起始目录（可选）',
        directoryHelp: '主机上的现有绝对路径。留空使用主机默认目录和 shell。',
        attachCreated: '创建后连接',
        rename: '重命名',
        newSessionName: '新会话名称',
        save: '保存',
        cancel: '取消',
        done: '完成',
        refresh: '刷新',
        loading: '正在加载…',
        working: '正在处理…',
        filterClients: '按会话筛选客户端',
        allSessions: '所有会话',
        selectAll: '全选',
        clearSelection: '清除选择',
        detachSelected: '断开所选客户端',
        detachConfirm: '断开以下客户端？会话和进程将继续运行。',
        noClients: '没有匹配的已连接客户端。',
        ownClient: '此停靠栏（共享）',
        ownClientHelp: '请使用停靠栏的断开按钮；这将断开所有浏览器查看者。',
        controlClient: '控制模式',
        terminalClient: '终端',
        windows: '窗口',
        created: '会话已创建。',
        renamed: '会话已重命名。',
        clientsDetached: '所选客户端已断开。',
        disconnected: '未连接到 tmux 主机，请等待重新连接后刷新。',
        requestTimeout: '请求超时，结果未知。请刷新后再重试。',
        requestInterrupted: '连接已关闭，结果未知。请重新连接并刷新。',
        connectedAt: '连接时间',
        selectClient: '选择客户端',
      },
      en: {
        nav: 'tmux',
        open: 'Open tmux',
        close: 'Hide',
        attach: 'Attach',
        detach: 'Detach',
        zoom: 'Zoom',
        unzoom: 'Unzoom pane',
        splitH: 'Split →',
        splitV: 'Split ↓',
        kill: 'Close pane',
        killConfirm: 'Close this pane? Its running process will be stopped.',
        movePane: 'Drag title to swap panes; double-click to zoom',
        kbd: 'Keyboard',
        fontDown: 'Smaller terminal text',
        fontUp: 'Larger terminal text',
        hint: 'Control-mode cockpit. Pushes the conversation. Drag sashes to resize.',
        keys: 'Pane shortcuts',
        keysHelp: 'With a terminal focused: Ctrl+B, then arrows, c, n/p, 0–9, x, z, d, " or %. Press Ctrl+B twice to send it literally.',
        itermKeys: 'iTerm2-compatible macOS shortcuts',
        itermKeysHelp: '⌃⇧⌘D detach; ⌃⇧⌘N/T or ⌥⇧⌘N/T new window; ⌥⌘X close pane; ⇧⌘↩ zoom; ⌃⌘Arrows resize; ⌥⇧⌘H/V split.',
        shortcutSafety: 'Browser-reserved iTerm2 chords—⌘D, all ⌘W variants, ⌘[/], and ⌥⌘Arrows—are intentionally not captured.',
        state: 'State',
        attached: 'Attached',
        detached: 'Detached',
        panes: 'Panes',
        notAttached: 'Pick a tmux session and attach.',
        sessionGone: 'That session is gone — pick another one.',
        noSessions: 'No tmux sessions on this host.',
        font: 'Terminal font',
        fontHelp: 'CSS font-family stack. Leave empty to prefer Berkeley Mono and other monospace fonts installed on this machine. Fonts must be installed on the computer viewing the GUI, not only on the DSH host.',
        fontPlaceholder: '"Berkeley Mono", monospace',
        fontHarness: 'Also use this font for DSH code (markdown, tool output, and sidebar terminals that follow the theme monospace)',
        dock: 'Dock',
        dockSide: 'Dock position',
        bottom: 'Bottom',
        right: 'Right',
        terminal: 'Terminal',
        fontSize: 'Preferred font size',
        fontSizeHelp: 'Mirror mode may shrink the font to preserve the complete real tmux grid.',
        cursorStyle: 'Cursor style',
        cursorBlock: 'Block',
        cursorUnderline: 'Underline',
        cursorBar: 'Bar',
        cursorBlink: 'Blinking cursor',
        scrollback: 'Scrollback lines',
        scrollbackHelp: 'Controls both xterm retention and tmux history requested after reconnect, up to 20,000 lines.',
        behavior: 'Behavior & safety',
        sizingPolicy: 'Window sizing policy',
        sizingAuto: 'Auto (take over when no sizing client exists)',
        sizingMirror: 'Mirror only (never resize tmux windows)',
        sizingHelp: 'This setting is shared by the host. Mobile always remains mirror-only.',
        confirmKill: 'Require confirmation before closing a pane',
        compactSplit: 'Enable compact splits: ⌥⌘D side-by-side, ⌥⇧⌘D top/bottom',
        compactSplitHelp: 'Stored only in this browser. Some macOS setups reserve ⌥⌘D for Show/Hide Dock; a system-intercepted chord cannot be overridden by the page.',
        reset: 'Reset local settings',
        resetHelp: 'Restores dock and terminal settings for this browser; keeps open state and selected session.',
        settingsUnavailable: 'Host settings are read-only on this connection.',
        viewers: 'Other sizing clients',
        manage: 'Sessions & clients',
        manageHelp: 'Manage all sessions on this tmux server. Attaching or detaching the dock affects every browser viewer.',
        sessions: 'Sessions',
        clients: 'Attached clients',
        clientHelp: 'These are native tmux clients, not browser tabs. Detaching leaves sessions and their processes running.',
        createSession: 'Create session',
        sessionName: 'Session name',
        sessionNameHelp: 'Up to 200 characters; no dots, colons, semicolons, or control characters.',
        startDirectory: 'Starting directory (optional)',
        directoryHelp: 'An existing absolute path on the host. Leave blank for the host default directory and shell.',
        attachCreated: 'Attach after creating',
        rename: 'Rename',
        newSessionName: 'New session name',
        save: 'Save',
        cancel: 'Cancel',
        done: 'Done',
        refresh: 'Refresh',
        loading: 'Loading…',
        working: 'Working…',
        filterClients: 'Filter clients by session',
        allSessions: 'All sessions',
        selectAll: 'Select all',
        clearSelection: 'Clear selection',
        detachSelected: 'Detach selected',
        detachConfirm: 'Detach these clients? Their sessions and processes will keep running.',
        noClients: 'No matching attached clients.',
        ownClient: 'This dock (shared)',
        ownClientHelp: 'Use the dock’s Detach button; it disconnects all browser viewers.',
        controlClient: 'Control mode',
        terminalClient: 'Terminal',
        windows: 'windows',
        created: 'Session created.',
        renamed: 'Session renamed.',
        clientsDetached: 'Selected clients detached.',
        disconnected: 'Not connected to the tmux host. Wait for reconnection, then refresh.',
        requestTimeout: 'Request timed out; the outcome is unknown. Refresh before retrying.',
        requestInterrupted: 'Connection closed; the outcome is unknown. Reconnect and refresh.',
        connectedAt: 'Connected',
        selectClient: 'Select client',
      },
    }
    let t = (k) => copy.en[k] || k
    /**
     * Active touch-scroll gestures hold repaints. A snapshot repaint mid-drag
     * re-fits fonts and re-places the shell under the finger — the "jiggle".
     * The guard auto-expires so a lost touchend can never wedge painting.
     */
    const gestureGuard = {
      owners: new Set(),
      since: 0,
      pending: false,
      onEnd: null,
      timer: 0,
      renew() {
        this.since = Date.now()
        clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          this.owners.clear()
          this.pending = false
          if (this.onEnd) this.onEnd()
        }, 1500)
      },
      begin(owner) { this.owners.add(owner); this.renew() },
      touch(owner) { this.owners.add(owner); this.renew() },
      end(owner) {
        this.owners.delete(owner)
        if (this.owners.size === 0) clearTimeout(this.timer)
        if (this.owners.size === 0 && this.pending) {
          this.pending = false
          if (this.onEnd) this.onEnd()
        }
      },
      holding() {
        if (this.owners.size === 0) return false
        if (Date.now() - this.since > 1500) { this.owners.clear(); return false }
        return true
      },
    }
    const defaultPrefs = {
      open: false,
      side: 'bottom',
      size: 280,
      session: '',
      fontFamily: '',
      fontSize: 12,
      mobileFontFloor: 12,
      cursorStyle: 'block',
      cursorBlink: true,
      scrollbackLines: 2000,
      confirmKill: true,
      compactSplitShortcuts: false,
      applyFontToHarness: false,
    }
    const HARNESS_FONT_STYLE_ID = 'dsh-tmux-cc-harness-font'
    /** Prefer fonts actually installed on the viewing machine; CSS falls through. */
    const DEFAULT_TERM_FONT = '"Berkeley Mono Nerd Font Mono", "Berkeley Mono", "JetBrainsMono Nerd Font Mono", "FiraCode Nerd Font Mono", "Hack Nerd Font Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
    function sanitizeFontFamily(value) {
      if (typeof value !== 'string') return ''
      const s = value.trim()
      if (!s || s.length > 300 || /[{}<>;\n\r]/.test(s)) return ''
      return s
    }
    function cssToken(name) {
      try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() }
      catch { return '' }
    }
    function termFontFamily(prefs) {
      const custom = sanitizeFontFamily(prefs && prefs.fontFamily)
      if (custom) return custom
      const fromCss = sanitizeFontFamily(cssToken('--dsh-tmux-cc-font'))
      if (fromCss) return fromCss
      return DEFAULT_TERM_FONT
    }
    function rootPixels(name) {
      const value = parseFloat(cssToken(name))
      return Number.isFinite(value) ? Math.max(0, value) : 0
    }
    function clampSize(side, size) {
      const raw = Number(size)
      if (!Number.isFinite(raw)) return side === 'right' ? 360 : 280
      if (side === 'right') {
        // Share the width that remains after a cooperating right panel (notably
        // dsh-better-sidebar) instead of letting two docks crush the chat.
        const available = Math.max(480, window.innerWidth - rootPixels('--dsh-sidebar-width'))
        return Math.max(240, Math.min(Math.floor(available * 0.5), raw))
      }
      const available = Math.max(340, window.innerHeight - rootPixels('--dsh-sidebar-height'))
      return Math.max(180, Math.min(available - 160, raw))
    }
    /** Render-time size: the stored pref stays raw so a small screen never
     *  overwrites the user's chosen size for bigger screens. */
    function viewSize(prefs) {
      return clampSize(prefs.side, prefs.size)
    }

    function normalizeLocalPrefs(value) {
      const source = value && typeof value === 'object' ? value : {}
      const side = source.side === 'right' ? 'right' : 'bottom'
      const rawSize = Number(source.size)
      const rawFontSize = Number(source.fontSize)
      const rawFloor = Number(source.mobileFontFloor)
      const rawScrollback = Number(source.scrollbackLines)
      return {
        open: source.open === true,
        side,
        size: Number.isFinite(rawSize) ? Math.max(120, Math.min(3000, Math.round(rawSize))) : defaultPrefs.size,
        session: typeof source.session === 'string' ? source.session.slice(0, 200) : '',
        fontFamily: sanitizeFontFamily(source.fontFamily),
        fontSize: Number.isFinite(rawFontSize)
          ? Math.max(8, Math.min(32, Math.round(rawFontSize * 4) / 4))
          : defaultPrefs.fontSize,
        mobileFontFloor: Number.isFinite(rawFloor)
          ? Math.max(6, Math.min(24, Math.round(rawFloor)))
          : defaultPrefs.mobileFontFloor,
        cursorStyle: ['block', 'underline', 'bar'].includes(source.cursorStyle) ? source.cursorStyle : defaultPrefs.cursorStyle,
        cursorBlink: source.cursorBlink === undefined ? defaultPrefs.cursorBlink : source.cursorBlink === true,
        scrollbackLines: Number.isFinite(rawScrollback)
          ? Math.max(0, Math.min(MAX_SCROLLBACK_LINES, Math.floor(rawScrollback)))
          : defaultPrefs.scrollbackLines,
        confirmKill: source.confirmKill === undefined ? defaultPrefs.confirmKill : source.confirmKill === true,
        compactSplitShortcuts: source.compactSplitShortcuts === true,
        applyFontToHarness: source.applyFontToHarness === true,
      }
    }
    function confirmPaneClose(enabled) {
      return !enabled || window.confirm(t('killConfirm'))
    }
    function loadPrefs() {
      try {
        const raw = localStorage.getItem(STORE_KEY)
        if (!raw) return { ...defaultPrefs }
        const document = JSON.parse(raw)
        // Every versioned document keeps preferences under `prefs`; normalize
        // older versions rather than resetting them when this schema advances.
        const source = document && document.prefs && typeof document.prefs === 'object'
          ? document.prefs
          : document
        return normalizeLocalPrefs(source)
      } catch { return { ...defaultPrefs } }
    }
    function savePrefs(prefs) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: PREFS_VERSION, prefs })) } catch { /* ignore */ }
    }

    function createStore() {
      let prefs = loadPrefs()
      let snapshot = null
      let error = ''
      let notice = ''
      let noticeTimer = 0
      let ws = null
      let lastAttachSent = 0
      let lastGridSent = null
      let resizeTimer = 0
      let resizeActive = null
      let reconnectTimer = 0
      let disposed = false
      let manualDetach = false
      const listeners = new Set()
      // pane id -> { wrap, label, termHost, term, seeded, fitRaf }
      const panes = new Map()
      const seeds = new Map()   // pane id -> authoritative capture (reset + write)
      const deltas = new Map()  // pane id -> live output buffered while unmounted
      const emit = () => { for (const fn of listeners) fn() }
      const send = (msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)) }
      let requestSequence = 0
      const requests = new Map()
      const failRequests = () => {
        for (const pending of requests.values()) {
          window.clearTimeout(pending.timer)
          pending.reject(new Error(t('requestInterrupted')))
        }
        requests.clear()
      }
      const api = {
        panes,
        get: () => ({ prefs, snapshot, error, notice, connected: !!(ws && ws.readyState === 1) }),
        closeManager: null,
        /** Correlate management replies; never replay mutations on reconnect. */
        managementRequest(type, fields = {}) {
          if (disposed || !ws || ws.readyState !== 1) return Promise.reject(new Error(t('disconnected')))
          const requestId = `manage-${++requestSequence}`
          return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
              requests.delete(requestId)
              reject(new Error(t('requestTimeout')))
            }, 30000)
            requests.set(requestId, { resolve, reject, timer })
            try { send({ ...fields, type, requestId }) }
            catch (err) {
              window.clearTimeout(timer)
              requests.delete(requestId)
              reject(err)
            }
          })
        },
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
        /** Transient browser-local status line (diagnostics); auto-clears. */
        notify(text) {
          notice = String(text || '')
          window.clearTimeout(noticeTimer)
          if (notice) noticeTimer = window.setTimeout(() => { notice = ''; emit() }, 9000)
          emit()
        },
        connect() {
          if (disposed || (ws && (ws.readyState === 0 || ws.readyState === 1))) return
          const proto = location.protocol === 'https:' ? 'wss' : 'ws'
          try { ws = new WebSocket(`${proto}://${location.host}/tmux-cc/ws`) }
          catch (err) { error = String(err); emit(); return }
          ws.onopen = () => {
            resizeActive = null
            lastGridSent = null
            send({ type: 'hello' })
            // Re-seed terminals after a reconnect at this browser's configured depth.
            send({ type: 'capture', lines: prefs.scrollbackLines })
            emit()
          }
          ws.onmessage = (ev) => {
            let msg
            try { msg = JSON.parse(String(ev.data)) } catch { return }
            if (msg.type === 'management' || (msg.type === 'error' && msg.requestId)) {
              const pending = requests.get(msg.requestId)
              if (!pending) return // timed out, unrelated, or duplicate reply
              requests.delete(msg.requestId)
              window.clearTimeout(pending.timer)
              if (msg.type === 'error') pending.reject(new Error(msg.message))
              else {
                if (snapshot) snapshot = { ...snapshot, sessions: msg.sessions }
                pending.resolve(msg)
                emit()
              }
              return
            }
            if (msg.type === 'snapshot') {
              snapshot = msg.snapshot
              error = msg.snapshot.error || ''
              if (msg.snapshot.attached) lastAttachSent = 0
            } else if (msg.type === 'history') {
              const rec = panes.get(msg.pane)
              if (rec && rec.term) {
                writeSeed(rec.term, msg.data)
                rec.seeded = true
                seeds.delete(msg.pane)
              } else {
                seeds.set(msg.pane, String(msg.data || '').slice(-BUFFER_CAP))
              }
              deltas.delete(msg.pane)
              return
            } else if (msg.type === 'output') {
              const rec = panes.get(msg.pane)
              if (rec && rec.term) {
                try { rec.term.write(msg.data) } catch { /* disposed */ }
              } else {
                deltas.set(msg.pane, ((deltas.get(msg.pane) || '') + msg.data).slice(-BUFFER_CAP))
              }
              return
            } else if (msg.type === 'error') error = msg.message
            emit()
          }
          ws.onerror = () => { error = 'websocket error'; emit() }
          ws.onclose = () => {
            ws = null
            failRequests()
            emit()
            if (!disposed) reconnectTimer = window.setTimeout(() => api.connect(), 1500)
          }
        },
        send,
        attach(session) {
          if (!session) return
          manualDetach = false
          lastAttachSent = Date.now()
          send({ type: 'attach', session })
        },
        /** User-initiated detach: suppress auto-attach until an explicit attach. */
        detach() {
          manualDetach = true
          send({ type: 'detach' })
        },
        /** Attach the preferred session when it is known to exist; retry gently. */
        maybeAutoAttach() {
          if (!snapshot || snapshot.attached || !prefs.open) return
          if (manualDetach) return
          const target = prefs.session
          if (!target) return
          const known = (snapshot.sessions || []).some((s) => s.name === target)
            || (snapshot.layouts || []).some((l) => l.session === target || l.id === target)
          if (!known) return
          if (Date.now() - lastAttachSent < 5000) return
          api.attach(target)
        },
        /**
         * Tell the host what grid the dock could hold at the native font.
         * Queue identity is recorded immediately and one-cell jitter is ignored,
         * so repeated paints cannot perpetually restart a flapping debounce.
         */
        queueResize(cols, rows) {
          if (disposed || document.body.dataset.dshTmuxDragging) return
          const next = { cols: Math.floor(cols), rows: Math.floor(rows) }
          if (lastGridSent && Math.abs(next.cols - lastGridSent.cols) <= 1 && Math.abs(next.rows - lastGridSent.rows) <= 1) return
          lastGridSent = next
          clearTimeout(resizeTimer)
          resizeTimer = window.setTimeout(() => {
            resizeTimer = 0
            resizeActive = true
            send({ type: 'resize', cols: next.cols, rows: next.rows })
          }, 600)
        },
        /** Release this browser's old takeover vote (closed/mobile/hidden). */
        clearResize() {
          clearTimeout(resizeTimer)
          resizeTimer = 0
          lastGridSent = null
          if (resizeActive !== false) send({ type: 'resize', active: false })
          resizeActive = false
        },
        /** Browser presentation preferences never cross the websocket. */
        setLocal(patch) {
          const next = normalizeLocalPrefs({ ...prefs, ...patch })
          if (patch.size !== undefined || patch.side !== undefined) next.size = clampSize(next.side, next.size)
          prefs = next
          savePrefs(prefs)
          emit()
        },
        setPrefs(patch) { api.setLocal(patch) },
        resetPrefs() {
          const keep = { open: prefs.open, session: prefs.session }
          prefs = normalizeLocalPrefs({ ...defaultPrefs, ...keep })
          savePrefs(prefs)
          emit()
        },
        requestKill(id, pane) {
          // Resolve the target BEFORE asking: a remote viewer can change the
          // active pane while a confirmation is open. Never kill that new pane.
          const target = pane || activePaneId(api)
          if (!target || !confirmPaneClose(prefs.confirmKill)) return
          send({ type: 'kill', pane: target })
        },
        /** Seed a freshly-mounted terminal from buffers, or ask the host to capture. */
        seedPane(id) {
          const rec = panes.get(id)
          if (!rec || !rec.term) return
          const seed = seeds.get(id)
          const delta = deltas.get(id)
          seeds.delete(id)
          deltas.delete(id)
          if (seed) {
            writeSeed(rec.term, seed + (delta || ''))
            rec.seeded = true
            return
          }
          try {
            if (delta) rec.term.write(delta)
          } catch { /* disposed */ }
          if (!rec.seeded) send({ type: 'capture', pane: id, lines: prefs.scrollbackLines })
        },
        disposePane(id) {
          const rec = panes.get(id)
          if (!rec) return
          if (rec.fitRaf) { try { cancelAnimationFrame(rec.fitRaf) } catch { /* ignore */ } }
          if (rec.overflowRaf) { try { cancelAnimationFrame(rec.overflowRaf) } catch { /* ignore */ } }
          if (rec.disposeTouch) rec.disposeTouch()
          if (rec.disposeTitle) rec.disposeTitle()
          try { if (rec.term) rec.term.dispose() } catch { /* ignore */ }
          rec.term = null // halts any in-flight momentum fling
          try { rec.wrap.remove() } catch { /* ignore */ }
          panes.delete(id)
        },
        disposeAllPanes() {
          for (const id of [...panes.keys()]) api.disposePane(id)
        },
        dispose() {
          if (disposed) return
          api.clearResize()
          disposed = true
          if (api.closeManager) api.closeManager()
          failRequests()
          window.clearTimeout(reconnectTimer)
          reconnectTimer = 0
          api.disposeAllPanes()
          if (ws) {
            ws.onclose = null
            try { ws.close(1000, 'plugin unload') } catch { /* already closed */ }
            ws = null
          }
          listeners.clear()
        },
      }
      return api
    }

    function el(tag, attrs, ...kids) {
      const node = document.createElement(tag)
      for (const [key, value] of Object.entries(attrs || {})) {
        if (key === 'style' && value && typeof value === 'object') Object.assign(node.style, value)
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value)
        else if (value === false || value == null) continue
        else if (key === 'text') node.textContent = value
        else node.setAttribute(key, value === true ? '' : String(value))
      }
      for (const kid of kids.flat()) {
        if (kid == null || kid === false) continue
        node.append(typeof kid === 'string' ? document.createTextNode(kid) : kid)
      }
      return node
    }

    const SELECT_CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"
    function injectStyle() {
      const css = `
/* z 10: above app content, below the DSH overlay layer (20) so modals cover us. */
#${ROOT_ID}{position:fixed;inset:0;pointer-events:none;z-index:10;overflow:hidden}
/* While the mobile drawer is open the document behind it must not scroll:
   touches that used to fall through scrolled the conversation underneath
   instead of the pane content. DSH scrolls inside its own containers, so
   locking the document is invisible to the app itself. */
html[data-dsh-tmux-mobile-lock],html[data-dsh-tmux-mobile-lock] body{
  overflow:hidden !important;
  overscroll-behavior:none;
}
/* Layout nodes are marked by this plugin, but all geometry remains in this
   owned stylesheet. No inline margin competes with DSH or better-sidebar. */
[data-dsh-tmux-frame]{
  margin-right:var(--dsh-tmux-width,0px);
  transition:margin-right var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
[data-dsh-tmux-conversation]{
  margin-bottom:calc(var(--dsh-sidebar-height,0px) + var(--dsh-tmux-height,0px)) !important;
  transition:margin-bottom var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
body[data-dsh-tmux-dragging] [data-dsh-tmux-frame],
body[data-dsh-tmux-dragging] [data-dsh-tmux-conversation],
body[data-dsh-sidebar-dragging] [data-dsh-tmux-frame],
body[data-dsh-sidebar-dragging] [data-dsh-tmux-conversation]{transition:none}
[data-tmux-cc-launcher]{
  pointer-events:auto;position:absolute;
  bottom:calc(12px + env(safe-area-inset-bottom) + var(--dsh-sidebar-height,0px));
  right:calc(12px + var(--dsh-sidebar-width,0px));
  width:36px;height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;padding:0;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
  box-shadow:var(--dsw-shadow-lv1, 0 1px 4px rgba(15,17,21,.14));
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  -webkit-app-region:no-drag;
  transition:background var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease),
    color var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
[data-tmux-cc-launcher]:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-tmux-cc-launcher][data-open]{display:none}
[data-tmux-cc-shell]{
  pointer-events:auto;position:absolute;z-index:6;
  display:flex;flex-direction:column;min-width:0;
  background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);
  font:var(--dsw-font-sm, 12px/1.4) ui-sans-serif,system-ui,sans-serif;
  transition:right var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease),
    bottom var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
body[data-dsh-tmux-dragging] [data-tmux-cc-shell],
body[data-dsh-sidebar-dragging] [data-tmux-cc-shell]{transition:none}
[data-tmux-cc-shell][data-side="bottom"]{border-top:1px solid var(--dsw-alias-border-l2)}
[data-tmux-cc-shell][data-side="right"]{border-left:1px solid var(--dsw-alias-border-l2)}
[data-tmux-cc-grip]{position:absolute;z-index:5;background:transparent;touch-action:none}
[data-tmux-cc-shell][data-side="bottom"] [data-tmux-cc-grip]{left:0;right:0;top:-5px;height:10px;cursor:row-resize}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-grip]{top:0;bottom:0;left:-5px;width:10px;cursor:col-resize}
[data-tmux-cc-shell][data-side="bottom"] [data-tmux-cc-grip]::after{
  content:'';position:absolute;left:50%;top:4px;transform:translateX(-50%);
  width:36px;height:3px;border-radius:2px;background:var(--dsw-alias-border-l2);
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-grip]::after{
  content:'';position:absolute;top:50%;left:4px;transform:translateY(-50%);
  width:3px;height:36px;border-radius:2px;background:var(--dsw-alias-border-l2);
}
[data-tmux-cc-grip]:hover::after,[data-tmux-cc-grip][data-active]::after{background:var(--dsw-alias-interactive-bg-hover-accent)}
[data-tmux-cc-bar]{
  display:flex;gap:4px;align-items:center;flex-wrap:nowrap;
  padding:3px 8px;height:34px;flex:none;min-width:0;
  border-bottom:1px solid var(--dsw-alias-border-l2);
  -webkit-app-region:no-drag;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-bar]{
  display:grid;
  grid-template-columns:minmax(0,auto) minmax(0,1fr);
  grid-template-rows:28px 28px;
  height:auto;min-height:56px;align-items:center;column-gap:4px;row-gap:2px;
  padding:3px 8px 3px;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-session]{
  grid-column:1 / -1;grid-row:1;max-width:none;min-width:0;width:calc(100% - 32px);
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-close]{
  grid-column:2;grid-row:1;justify-self:end;margin-left:0;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-tabs]{
  grid-column:1;grid-row:2;flex:none;min-width:0;max-width:none;justify-self:start;
  overflow:hidden;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-actions]{
  grid-column:2;grid-row:2;display:flex;gap:2px;align-items:center;min-width:0;
  overflow-x:auto;scrollbar-width:none;justify-self:end;max-width:100%;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-actions]::-webkit-scrollbar{display:none}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-side]{max-width:72px}
[data-tmux-cc-bar] select{
  appearance:none;-webkit-appearance:none;
  background:var(--dsw-alias-bg-layer-1) ${SELECT_CHEVRON} no-repeat right 5px center/10px;
  color:inherit;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;font:inherit;
  height:24px;padding:0 18px 0 8px;
  max-width:140px;min-width:0;flex:none;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;
}
[data-tmux-cc-bar] select:hover{border-color:var(--dsw-alias-border-l2)}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-bar] select{max-width:none}
[data-tmux-cc-icon]{
  width:28px;height:28px;border:none;border-radius:50%;padding:0;cursor:pointer;flex:none;
  background:transparent;color:var(--dsw-alias-label-secondary);
  display:inline-flex;align-items:center;justify-content:center;
  transition:background var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease),
    color var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
[data-tmux-cc-icon]:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
/* Hardware keyboards need no toggle; shown on mobile below, along with the
   font-floor stepper that trades grid fit against legibility. */
[data-tmux-cc-kbd],[data-tmux-cc-font-down],[data-tmux-cc-font-up]{display:none}
[data-tmux-cc-icon]:disabled{opacity:.4;cursor:default}
[data-tmux-cc-icon][aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}
[data-tmux-cc-close]{margin-left:auto}
[data-tmux-cc-error]{
  color:var(--dsw-alias-state-error-primary,#c00);padding:4px 10px;flex:none;
  background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent);
}
[data-tmux-cc-body]{position:relative;flex:1;min-height:0;min-width:0;background:var(--dsw-alias-bg-layer-1)}
[data-tmux-cc-pane]{
  position:absolute;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1);
  box-shadow:inset -1px -1px 0 0 var(--dsw-alias-border-l2);
}
[data-tmux-cc-pane][data-active="1"]{outline:1px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px;z-index:1}
[data-tmux-cc-pane][data-active="1"] [data-tmux-cc-ptitle]{color:var(--dsw-alias-label-primary)}
[data-tmux-cc-ptitle]{
  flex:none;display:flex;align-items:center;gap:2px;padding:0 4px 0 8px;height:22px;
  font:var(--dsw-font-xxxs-strong-11, 11px/1.2 ui-sans-serif,system-ui,sans-serif);
  color:var(--dsw-alias-label-secondary);
  border-bottom:1px solid var(--dsw-alias-border-l2);
  user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab;
}
[data-tmux-cc-ptitle][data-dragging]{cursor:grabbing;background:var(--dsw-alias-interactive-bg-hover)}
[data-tmux-cc-pane][data-drop-target]{outline:3px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-3px}
[data-tmux-cc-ptitle] span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-tmux-cc-pclose]{
  width:18px;height:18px;border:none;border-radius:4px;padding:0;flex:none;
  background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  opacity:0;
}
[data-tmux-cc-pane]:hover [data-tmux-cc-pclose],
[data-tmux-cc-pane][data-active="1"] [data-tmux-cc-pclose]{opacity:1}
[data-tmux-cc-pclose]:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
/* Stable gesture surface above xterm's ever-re-rendered rows. Hidden on
   desktop so the mouse reaches xterm directly; the client forwards wheel
   events through it when visible. */
[data-tmux-cc-touch]{position:absolute;inset:0;z-index:2;display:none;touch-action:none;background:transparent}
[data-tmux-cc-sash]{position:absolute;z-index:3;background:transparent;touch-action:none;user-select:none;-webkit-user-select:none}
[data-tmux-cc-sash][data-dir="v"]{cursor:ew-resize;width:8px;top:0;bottom:0;margin-left:-4px}
[data-tmux-cc-sash][data-dir="h"]{cursor:ns-resize;height:8px;left:0;right:0;margin-top:-4px}
[data-tmux-cc-sash]:hover,[data-tmux-cc-sash][data-active="1"]{background:var(--dsw-alias-interactive-bg-hover-accent)}
/* Pane dividers remain usable on phones and touch-enabled desktop layouts.
   Only the boundary owns resize; the terminal surface still owns scrolling. */
@media (max-width:767px),(any-pointer:coarse){
  [data-tmux-cc-sash][data-dir="v"]{width:24px;margin-left:-12px}
  [data-tmux-cc-sash][data-dir="h"]{height:24px;margin-top:-12px}
  [data-tmux-cc-sash]::after{
    content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    border-radius:3px;background:var(--dsw-alias-label-tertiary,#888);pointer-events:none;
  }
  [data-tmux-cc-sash][data-dir="v"]::after{width:3px;height:32px;max-height:50%}
  [data-tmux-cc-sash][data-dir="h"]::after{height:3px;width:32px;max-width:50%}
  [data-tmux-cc-sash][data-active="1"]::after{background:var(--dsw-alias-label-primary,#ddd)}
}
[data-tmux-cc-empty]{padding:16px;color:var(--dsw-alias-label-secondary)}
[data-tmux-cc-actions]{display:contents}
[data-tmux-cc-tabs]{display:flex;gap:2px;overflow:auto;flex:1;min-width:0;scrollbar-width:thin}
[data-tmux-cc-tab]{
  border:none;background:transparent;color:var(--dsw-alias-label-secondary);
  padding:4px 8px;border-radius:8px;cursor:pointer;white-space:nowrap;flex:none;
}
[data-tmux-cc-tab][data-active="1"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-tmux-cc-launcher]:focus-visible,[data-tmux-cc-pclose]:focus-visible,
[data-tmux-cc-icon]:focus-visible,[data-tmux-cc-tab]:focus-visible,[data-tmux-cc-bar] select:focus-visible{
  outline:2px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:1px;
}
[data-tmux-cc-pane] .xterm{flex-shrink:0}
[data-tmux-cc-pane] .xterm,[data-tmux-cc-pane] .xterm-viewport{background:transparent !important}
/* Pane cells are small; a permanent scrollbar column steals real columns.
   Wheel and touch scrolling still work without the chrome. */
[data-tmux-cc-pane] .xterm-viewport{scrollbar-width:none}
[data-tmux-cc-pane] .xterm-viewport::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion:reduce){
  [data-tmux-cc-launcher],[data-tmux-cc-icon]{transition:none}
}
/* Pairs with NARROW_MAX_WIDTH = 768 in the client logic: 767px is mobile. */
@media (max-width:767px){
  [data-tmux-cc-launcher]{
    bottom:calc(12px + env(safe-area-inset-bottom));right:12px;width:40px;height:40px;
  }
  [data-tmux-cc-shell][data-mobile="1"]{
    box-sizing:border-box;border:0;max-width:none;min-width:0;padding-bottom:env(safe-area-inset-bottom);transition:none;
    /* Allow horizontal toolbar scrolling. An ancestor's touch-action:none
       cannot be overridden by its row scrollers. Terminal/title surfaces
       claim their own gestures; vertical page scrolling stays disabled. */
    touch-action:pan-x;overscroll-behavior:none;
    -webkit-tap-highlight-color:transparent;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-grip]{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-bar]{
    display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:44px auto 48px;
    height:auto;min-height:96px;gap:2px;padding:calc(4px + env(safe-area-inset-top)) 8px 4px;
    border-bottom:1px solid var(--dsw-alias-border-l2);
  }
  /* With the on-screen keyboard up, vertical space is scarce: collapse the
     session picker and window tabs and keep only the action row. */
  [data-tmux-cc-shell][data-mobile="1"][data-kbd="1"] [data-tmux-cc-bar]{
    grid-template-rows:0 0 48px;min-height:56px;gap:0;
  }
  [data-tmux-cc-shell][data-mobile="1"][data-kbd="1"] [data-tmux-cc-session],
  [data-tmux-cc-shell][data-mobile="1"][data-kbd="1"] [data-tmux-cc-tabs]{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-session]{
    grid-column:1;grid-row:1;width:100%;max-width:none;min-height:44px;padding:0 28px 0 12px;
    background-position:right 10px center;background-size:12px;
    border-radius:8px;background-color:var(--dsw-alias-interactive-bg-hover);font-size:16px;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-tabs]{
    grid-column:1;grid-row:2;min-height:0;touch-action:pan-x;overscroll-behavior:contain;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-tabs]:empty{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-actions]{
    display:flex;grid-column:1;grid-row:3;align-items:center;gap:4px;overflow-x:auto;min-width:0;
    scrollbar-width:none;padding-right:52px;touch-action:pan-x;overscroll-behavior:contain;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-actions]::-webkit-scrollbar{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-icon]{width:44px;height:44px}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-kbd],
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-font-down],
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-font-up]{display:inline-flex}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-side]{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-close]{
    grid-column:1;grid-row:3;justify-self:end;align-self:center;margin-left:0;z-index:1;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-tab]{
    min-width:48px;max-width:144px;min-height:40px;padding:8px 10px;
    overflow:hidden;text-overflow:ellipsis;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-ptitle]{height:32px;padding-left:10px;font-size:13px}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-pclose]{width:32px;height:32px;opacity:1}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-touch]{display:block}
  /* xterm parks its focus textarea at left:-9999em. iOS insists on
     scrolling a newly-focused element into view, and with the document
     scroll-locked that reveal is impossible — Safari then refuses to show
     the software keyboard at all. Pin the (invisible: opacity 0, 0x0)
     textarea inside the viewport so the reveal is a no-op. The 16px font
     also keeps iOS from auto-zooming on focus. */
  [data-tmux-cc-shell][data-mobile="1"] .xterm-helper-textarea{
    position:fixed !important;font-size:16px !important;
    left:12px !important;top:60px !important;width:1px !important;height:1px !important;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-empty]{padding:20px}
}
[data-tmux-cc-manager]{
  pointer-events:auto;box-sizing:border-box;position:fixed;inset:12px 0 auto;
  width:min(720px,calc(100vw - 24px));max-width:calc(100vw - 24px);margin:0 auto;
  padding:20px;border:1px solid var(--dsw-alias-border-l2,#666);border-radius:14px;
  background:var(--dsw-alias-bg-layer-1,#181a1f);color:var(--dsw-alias-label-primary,#f1f1f1);
  font:14px/1.5 ui-sans-serif,system-ui,sans-serif;overflow:auto;overscroll-behavior:contain;
  box-shadow:0 16px 60px #0006;
}
[data-tmux-cc-manager]::backdrop{background:#0007}
[data-tmux-cc-manager] *{box-sizing:border-box;min-width:0}
[data-tmux-cc-manager] header{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  position:sticky;top:0;z-index:3;background:var(--dsw-alias-bg-layer-1,#181a1f);padding:6px 0;
}
[data-tmux-cc-manager] input,[data-tmux-cc-manager] button,[data-tmux-cc-manager] select{scroll-margin-top:72px}
[data-tmux-cc-manager] h2{font-size:20px;margin:0}
[data-tmux-cc-manager] h3{font-size:16px;margin:0 0 12px}
[data-tmux-cc-manager] p{font-size:12px;color:var(--dsw-alias-label-secondary,#aaa);margin:5px 0 12px;overflow-wrap:anywhere}
[data-tmux-cc-manager] strong{overflow-wrap:anywhere}
[data-tmux-cc-manager] button,[data-tmux-cc-manager] input:not([type="checkbox"]),[data-tmux-cc-manager] select{
  font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l2,#666);border-radius:7px;
  background:var(--dsw-alias-bg-layer-2,#252830);min-height:36px;padding:6px 10px;max-width:100%;
}
[data-tmux-cc-manager] button{cursor:pointer}
[data-tmux-cc-manager] button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#343843)}
[data-tmux-cc-manager] :disabled{opacity:.5;cursor:default}
[data-tmux-cc-manager] :focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#7b9fff);outline-offset:2px}
[data-tmux-cc-manager] input[type="checkbox"]{width:18px;height:18px;flex:none;margin:0}
[data-tmux-cc-field]{display:flex;flex-direction:column;gap:4px;margin:8px 0}
[data-tmux-cc-field] input,[data-tmux-cc-field] select{width:100%}
[data-tmux-cc-check]{display:flex;align-items:center;gap:8px;min-height:36px;margin:4px 0}
[data-tmux-cc-manager-content]{display:grid;gap:20px;margin-top:12px}
[data-tmux-cc-manager-content]>section,[data-tmux-cc-create-form]{border-top:1px solid var(--dsw-alias-border-l2,#444);padding-top:16px}
[data-tmux-cc-manager-actions]{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
[data-tmux-cc-client-actions]{position:sticky;top:64px;z-index:2;padding:6px 0;background:var(--dsw-alias-bg-layer-1,#181a1f)}
[data-tmux-cc-session-row],[data-tmux-cc-client-row]{padding:12px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:8px;margin-top:8px}
[data-tmux-cc-session-row]{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
[data-tmux-cc-session-row] form{width:100%}
[data-tmux-cc-client-row] p:last-child,[data-tmux-cc-session-row] p{margin-bottom:0}
[data-tmux-cc-manager-error]{color:var(--dsw-alias-state-error-primary,#ff9b9b);overflow-wrap:anywhere}
@media(max-width:767px){
  [data-tmux-cc-manager]{padding:16px}
  [data-tmux-cc-manager] button,[data-tmux-cc-manager] input:not([type="checkbox"]),[data-tmux-cc-manager] select{min-height:44px;font-size:16px}
  [data-tmux-cc-check]{min-height:44px}
}
`
      let node = document.getElementById(STYLE_ID)
      if (!node) {
        node = el('style', { id: STYLE_ID })
        document.head.append(node)
      }
      node.textContent = css
    }

    function icon(path) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '16')
      svg.setAttribute('height', '16')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '2')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      svg.innerHTML = path
      return svg
    }

    function conversationColumn() {
      // The conversation slot is stable across shell hashes and its parent is
      // the AppFrame center column. Keep the old suffix as a compatibility
      // fallback for older DSH builds without slot markers.
      return document.querySelector('#root [data-slot="conversation"]')?.parentElement
        || document.querySelector('#root [class*="_centerCol"]')
        || document.querySelector('#root [class*="centerCol"]')
    }

    const NARROW_MAX_WIDTH = 768
    function isNarrowViewport() {
      return window.innerWidth < NARROW_MAX_WIDTH
    }

    /**
     * The exact box the user can currently see: the visual viewport. On mobile
     * the on-screen keyboard and collapsing URL bar shrink it, and iOS pans it
     * across the (unchanged) layout viewport while the keyboard is open.
     */
    function mobileViewportBox() {
      const vv = window.visualViewport
      if (!vv) return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
      return {
        x: Math.max(0, vv.offsetLeft || 0),
        y: Math.max(0, vv.offsetTop || 0),
        width: vv.width || window.innerWidth,
        height: vv.height || window.innerHeight,
      }
    }

    /**
     * While the mobile drawer is open the page behind it must not scroll:
     * a touch that slipped past the drawer used to scroll the conversation
     * underneath instead of the pane content. The lock is plugin-owned CSS
     * on <html>/<body>; it never touches DSH inline styles.
     */
    function setMobileLock(on) {
      const root = document.documentElement
      if (on === root.hasAttribute('data-dsh-tmux-mobile-lock')) return
      if (on) root.setAttribute('data-dsh-tmux-mobile-lock', '')
      else root.removeAttribute('data-dsh-tmux-mobile-lock')
      // Ask the browser to resize the layout viewport for the on-screen
      // keyboard instead of overlaying it (interactive-widget). A layout
      // viewport that tracks the keyboard leaves no leftover range for the
      // browser-level pan that steals drag gestures. Chromium only: it is
      // the engine that honors the key, and Safari's viewport re-parsing of
      // dynamic meta rewrites has a history of quirks not worth risking.
      try {
        const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.length)
        const meta = chromium ? document.querySelector('meta[name="viewport"]') : null
        if (meta) {
          if (on) {
            if (meta.dataset.dshTmuxViewport === undefined) {
              meta.dataset.dshTmuxViewport = meta.getAttribute('content') || ''
            }
            if (!meta.dataset.dshTmuxViewport.includes('interactive-widget')) {
              meta.setAttribute('content', `${meta.dataset.dshTmuxViewport}, interactive-widget=resizes-content`)
            }
          } else if (meta.dataset.dshTmuxViewport !== undefined) {
            meta.setAttribute('content', meta.dataset.dshTmuxViewport)
            delete meta.dataset.dshTmuxViewport
          }
        }
      } catch { /* ignore */ }
    }

    /** Whether the on-screen keyboard target (an xterm textarea) has focus. */
    function dockTerminalFocused() {
      const host = document.getElementById(ROOT_ID)
      const focused = document.activeElement
      return !!(host && focused && host.contains(focused) && focused.closest && focused.closest('.xterm'))
    }

    function setRootPixels(name, value) {
      const next = `${Math.max(0, value)}px`
      if (document.documentElement.style.getPropertyValue(name) !== next) {
        document.documentElement.style.setProperty(name, next)
      }
    }

    function writePush(prefs) {
      const open = prefs.open && !isNarrowViewport()
      const size = Math.max(0, viewSize(prefs))
      const side = prefs.side === 'right' ? 'right' : 'bottom'
      setRootPixels('--dsh-tmux-height', open && side === 'bottom' ? size : 0)
      setRootPixels('--dsh-tmux-width', open && side === 'right' ? size : 0)
    }

    function clearPush() {
      document.documentElement.style.removeProperty('--dsh-tmux-height')
      document.documentElement.style.removeProperty('--dsh-tmux-width')
    }

    function placeShell(shell, prefs) {
      const col = conversationColumn()
      const size = viewSize(prefs)
      shell.dataset.side = prefs.side === 'right' ? 'right' : 'bottom'
      if (isNarrowViewport()) {
        const vp = mobileViewportBox()
        shell.dataset.mobile = '1'
        // Size and position are tracked separately. A size write re-fits every
        // pane font, so sub-2px jitter (URL-bar settling, scroll rounding)
        // must not resize the shell — but the keyboard opening or closing
        // changes the height by hundreds of pixels and applies immediately.
        const width = Math.round(vp.width)
        const height = Math.round(vp.height)
        const prevW = Number(shell.dataset.vpWidth)
        const prevH = Number(shell.dataset.vpHeight)
        const sizeSame = Number.isFinite(prevW) && Math.abs(prevW - width) < 2
          && Number.isFinite(prevH) && Math.abs(prevH - height) < 2
        if (!sizeSame) {
          shell.dataset.vpWidth = String(width)
          shell.dataset.vpHeight = String(height)
          Object.assign(shell.style, {
            top: '0', left: '0', right: 'auto', bottom: 'auto',
            width: `${width}px`,
            height: `${height}px`,
          })
        }
        // Browser-level visual-viewport panning (keyboard open, URL bar) can
        // never be cancelled from script; instead the drawer follows it
        // exactly. A transform moves the shell without resizing it, so
        // tracking a pan never re-fits fonts and the page underneath can
        // never peek through.
        const tx = Math.round(vp.x)
        const ty = Math.round(vp.y)
        const transform = tx || ty ? `translate(${tx}px, ${ty}px)` : ''
        if (shell.style.transform !== transform) shell.style.transform = transform
        return
      }
      delete shell.dataset.mobile
      delete shell.dataset.vpWidth
      delete shell.dataset.vpHeight
      if (shell.style.transform) shell.style.transform = ''
      if (!col || prefs.side === 'right') {
        if (prefs.side === 'right') {
          Object.assign(shell.style, {
            top: '0', bottom: '0', right: 'var(--dsh-sidebar-width, 0px)', left: 'auto',
            width: `${size}px`, height: 'auto',
          })
        } else {
          Object.assign(shell.style, {
            left: '0', right: '0', bottom: 'var(--dsh-sidebar-height, 0px)', top: 'auto',
            width: 'auto', height: `${size}px`,
          })
        }
        return
      }
      const r = col.getBoundingClientRect()
      Object.assign(shell.style, {
        left: `${r.left}px`,
        width: `${r.width}px`,
        bottom: 'var(--dsh-sidebar-height, 0px)',
        height: `${size}px`,
        top: 'auto',
        right: 'auto',
      })
    }

    let xtermReady = null
    function loadXterm() {
      if (window.Terminal) return Promise.resolve()
      if (xtermReady) return xtermReady
      xtermReady = new Promise((resolve, reject) => {
        const css = document.createElement('link')
        css.rel = 'stylesheet'
        css.href = '/tmux-cc/vendor/xterm.css'
        document.head.appendChild(css)
        const s1 = document.createElement('script')
        s1.src = '/tmux-cc/vendor/xterm.js'
        s1.onload = () => resolve()
        s1.onerror = () => reject(new Error('failed to load xterm'))
        document.head.appendChild(s1)
      })
      return xtermReady
    }

    function neighbor(panes, pane, axis) {
      const gap = 2
      if (axis === 'x') {
        return panes.find((other) => other.id !== pane.id
          && Math.abs(other.left - (pane.left + pane.width)) <= gap
          && other.top < pane.top + pane.height
          && other.top + other.height > pane.top)
      }
      return panes.find((other) => other.id !== pane.id
        && Math.abs(other.top - (pane.top + pane.height)) <= gap
        && other.left < pane.left + pane.width
        && other.left + other.width > pane.left)
    }

    let cellCache = null
    let cellCacheFont = ''
    /** Character cell size of the terminal font at the preferred native size. */
    function measureCell(body, fontFamily, fontSize) {
      const family = fontFamily || DEFAULT_TERM_FONT
      const size = Number(fontSize) || defaultPrefs.fontSize
      const cacheKey = `${family}\0${size}`
      if (cellCache && cellCacheFont === cacheKey) return cellCache
      const probe = el('div', {
        style: {
          position: 'absolute', visibility: 'hidden', whiteSpace: 'pre',
          fontFamily: family,
          fontSize: `${size}px`,
          // xterm's native row height is ~1.2x the font size; the browser's
          // default "normal" line-height (~1.4) would under-report rows and
          // leave a vertical letterbox in the dock.
          lineHeight: '1.2',
        },
        text: 'W'.repeat(40),
      })
      body.append(probe)
      const r = probe.getBoundingClientRect()
      probe.remove()
      if (r.width > 0 && r.height > 0) {
        cellCache = { w: r.width / 40, h: r.height }
        cellCacheFont = cacheKey
      }
      return cellCache || { w: 7.2 * size / 12, h: 14.5 * size / 12 }
    }

    /** Report the dock's native-font grid so the host can size the window when alone. */
    function reportDockGrid(store, body) {
      // Mobile viewers never dictate the shared tmux window size: the
      // on-screen keyboard and URL-bar churn would resize tmux on every
      // focus/scroll. Explicitly retract a grid reported before the viewport
      // crossed the breakpoint instead of merely ceasing new reports.
      if (isNarrowViewport() || document.body.dataset.dshTmuxDragging) {
        store.clearResize()
        return
      }
      const rect = body.getBoundingClientRect()
      if (rect.width < 60 || rect.height < 40) {
        store.clearResize()
        return
      }
      // Each stacked row of panes carries a 22px title bar the cells can't use.
      const snap = store.get().snapshot
      const stacks = snap && snap.panes && snap.panes.length
        ? new Set(snap.panes.map((p) => p.top)).size
        : 1
      const prefs = store.get().prefs
      const cell = measureCell(body, termFontFamily(prefs), prefs.fontSize)
      const cols = Math.max(20, Math.floor(rect.width / cell.w))
      const rows = Math.max(6, Math.floor((rect.height - 22 * stacks - 2) / cell.h))
      store.queueResize(cols, rows)
    }

    /** One monotone fit step: one font-size degree of freedom, quantized down. */
    function fittedFontSize(current, screenWidth, screenHeight, hostWidth, hostHeight, preferred = 18, minimum = 5) {
      const scale = Math.min(hostWidth / screenWidth, hostHeight / screenHeight)
      const target = current * scale
      return Math.max(minimum, Math.min(preferred, Math.floor((target + 1e-6) * 4) / 4))
    }

    /**
     * Faithful sizing: xterm keeps the exact tmux cell grid and a single font
     * size fits that grid inside its pixel box. Older code also iterated
     * letterSpacing and lineHeight; xterm's integer row rounding made those
     * measurements feed back into one another as a permanent two-state cycle.
     * Residual space is intentionally centered by termHost instead.
     */
    function fitPane(rec, pane) {
      const term = rec.term
      if (!term) return
      if ((term.cols !== pane.width || term.rows !== pane.height) && pane.width > 1 && pane.height > 1) {
        try {
          term.resize(pane.width, pane.height)
          rec.fitKey = ''
        } catch { /* transient */ }
      }
      if (rec.fitRaf) return
      rec.fitRaf = requestAnimationFrame(() => {
        rec.fitRaf = null
        const screen = rec.termHost.querySelector('.xterm-screen')
        if (!screen || !rec.term) return
        const gw = screen.offsetWidth
        const gh = screen.offsetHeight
        const hw = rec.termHost.clientWidth
        const hh = rec.termHost.clientHeight
        const cols = term.cols
        const rows = term.rows
        if (!gw || !gh || !hw || !hh || !cols || !rows) return
        const preferred = rec.preferredFontSize || defaultPrefs.fontSize
        const mobile = isNarrowViewport()
        const cur = term.options.fontSize || preferred
        // Mobile reading floor: never fit below the floor (adjustable from
        // the mobile toolbar; default MOBILE_MIN_FONT). The grid then
        // overflows and syncPaneOverflow makes the overflow pannable. A
        // floor above the preferred size wins, so the toolbar can also
        // enlarge text beyond the desktop preference.
        const floor = rec.mobileFontFloor || MOBILE_MIN_FONT
        // Mobile text is a user-selected size, not a function of the keyboard
        // height. Only the visible crop changes when the keyboard animates.
        const minimum = mobile ? floor : 5
        const key = `${cols}x${rows}:${hw}x${hh}:${preferred}:${mobile ? `m${floor}` : 'd'}:${window.devicePixelRatio || 1}`
        if (rec.fitKey === key) return
        rec.fitKey = key
        const next = mobile ? floor : fittedFontSize(cur, gw, gh, hw, hh, preferred, minimum)
        const neutral = (term.options.letterSpacing || 0) === 0 && (term.options.lineHeight || 1) === 1
        if (!(Math.abs(next - cur) < 0.25 && neutral)) {
          try {
            term.options.fontSize = next
            term.options.letterSpacing = 0
            term.options.lineHeight = 1
          } catch { /* ignore */ }
        }
        syncPaneOverflow(rec)
      })
    }

    /**
     * With the mobile font floor the true tmux grid can be larger than its
     * pane box. Anchor an overflowing terminal to the top-left so both edges
     * are reachable by panning, and keep the visible window pinned to the
     * bottom rows (where the prompt lives) until the reader pans away.
     * Centering remains for terminals that fit, matching desktop.
     */
    function syncPaneOverflow(rec) {
      if (rec.overflowRaf) return
      rec.overflowRaf = requestAnimationFrame(() => {
        rec.overflowRaf = null
        const host = rec.termHost
        const screen = host && host.querySelector('.xterm-screen')
        if (!screen || !rec.term) return
        const overX = screen.offsetWidth > host.clientWidth + 1
        const overY = screen.offsetHeight > host.clientHeight + 1
        host.style.justifyContent = overX ? 'flex-start' : 'center'
        host.style.alignItems = overY ? 'flex-start' : 'center'
        host.scrollLeft = overX ? (rec.panLeft || 0) : 0
        host.scrollTop = overY
          ? (rec.vPinned !== false ? host.scrollHeight : (rec.panTop || 0))
          : 0
      })
    }

    /**
     * tmux pane_width/pane_height exclude the one-cell separator to the right
     * and below an interior pane. Extend the visual box through that separator
     * so adjacent borders meet, while xterm still keeps the true pane grid.
     */
    function paneVisualBox(pane, cols, rows) {
      const width = pane.width + (pane.left + pane.width < cols ? 1 : 0)
      const height = pane.height + (pane.top + pane.height < rows ? 1 : 0)
      return { left: pane.left, top: pane.top, width, height }
    }

    function applyHarnessFont(prefs) {
      let tag = document.getElementById(HARNESS_FONT_STYLE_ID)
      if (!prefs.applyFontToHarness) {
        if (tag) tag.remove()
        return
      }
      if (!tag) {
        tag = el('style', { id: HARNESS_FONT_STYLE_ID })
        document.head.appendChild(tag)
      }
      const family = termFontFamily(prefs)
      tag.textContent = `:root{--dsh-tmux-cc-font:${family};--ds-font-family-code:${family};--dsw-font-mono:${family}}`
    }

    /** Push all browser-local terminal preferences into existing and future panes. */
    function applyLiveFont(store) {
      const prefs = store.get().prefs
      const family = termFontFamily(prefs)
      applyHarnessFont(prefs)
      const host = document.getElementById(ROOT_ID)
      const key = [
        family,
        prefs.fontSize,
        prefs.mobileFontFloor,
        prefs.cursorStyle,
        prefs.cursorBlink ? '1' : '0',
        prefs.scrollbackLines,
        prefs.applyFontToHarness ? '1' : '0',
      ].join('\0')
      if (host && host.dataset.terminalPrefsKey === key) return
      const oldScrollback = host ? host.dataset.scrollbackLines : undefined
      if (host) {
        host.dataset.terminalPrefsKey = key
        host.dataset.scrollbackLines = String(prefs.scrollbackLines)
      }
      const historyChanged = oldScrollback !== undefined && oldScrollback !== String(prefs.scrollbackLines)
      cellCache = null
      cellCacheFont = ''
      for (const [paneId, rec] of store.panes) {
        if (!rec.term) continue
        rec.preferredFontSize = prefs.fontSize
        rec.mobileFontFloor = prefs.mobileFontFloor
        rec.fitKey = ''
        try {
          rec.term.options.fontFamily = family
          rec.term.options.fontSize = prefs.fontSize
          rec.term.options.cursorStyle = prefs.cursorStyle
          rec.term.options.cursorBlink = prefs.cursorBlink
          rec.term.options.scrollback = prefs.scrollbackLines
        } catch { /* disposed */ }
        if (historyChanged) store.send({ type: 'capture', pane: paneId, lines: prefs.scrollbackLines })
      }
      const ready = () => {
        cellCache = null
        cellCacheFont = ''
        const body = document.querySelector('[data-tmux-cc-body]')
        if (body) reportDockGrid(store, body)
        const snap = store.get().snapshot
        const panes = snap && snap.panes ? snap.panes : []
        for (const pane of panes) {
          const rec = store.panes.get(pane.id)
          if (rec && rec.term) fitPane(rec, pane)
        }
      }
      if (document.fonts && document.fonts.load) {
        const first = family.split(',')[0].trim()
        Promise.all([
          document.fonts.load(`${prefs.fontSize}px ${first}`),
          document.fonts.load(`bold ${prefs.fontSize}px ${first}`),
        ]).then(ready, ready)
      } else {
        ready()
      }
    }

    /** Live terminal theme, re-read from DSH CSS variables. */
    function termTheme() {
      const cs = getComputedStyle(document.body)
      return {
        background: cs.getPropertyValue('--dsw-alias-bg-layer-1').trim() || '#fff',
        foreground: cs.getPropertyValue('--dsw-alias-label-primary').trim() || '#0f1115',
        cursor: cs.getPropertyValue('--dsw-alias-label-primary').trim() || '#0f1115',
        selectionBackground: cs.getPropertyValue('--dsw-alias-interactive-bg-hover').trim() || '#00000022',
      }
    }

    /**
     * Reset + write an authoritative capture, preserving how far the reader
     * had scrolled up from the bottom. Re-seeds arrive on reconnects and
     * window switches; unconditionally yanking the viewport to the bottom
     * threw mobile readers out of the scrollback they were looking at.
     */
    function writeSeed(term, data) {
      let fromBottom = 0
      try {
        const buf = term.buffer && term.buffer.active
        if (buf) fromBottom = Math.max(0, buf.baseY - buf.viewportY)
      } catch { /* ignore */ }
      try {
        term.reset()
        term.write(data, () => {
          try {
            term.scrollToBottom()
            if (fromBottom > 0) term.scrollLines(-fromBottom)
          } catch { /* disposed */ }
        })
      } catch { /* disposed */ }
    }

    function focusPane(rec) {
      if (!rec || !rec.term) return
      // preventScroll also prevents overflow:hidden ancestors being scrolled
      // to reveal xterm's caret. The mobile textarea lives outside the crop.
      try {
        if (rec.term.textarea) rec.term.textarea.focus({ preventScroll: true })
        else rec.term.focus()
      } catch { /* disposed */ }
    }

    function bindPaneTitle(title, rec, pane, store) {
      let cancel = null
      let lastTap = 0
      const down = (event) => {
        if (event.button !== 0 || event.isPrimary === false || event.target.closest('button')) return
        title._tmuxPointerType = event.pointerType
        event.preventDefault()
        event.stopPropagation()
        if (cancel) cancel()
        const x = event.clientX
        const y = event.clientY
        let dragging = false
        let target = null
        const clearTarget = () => {
          if (target) target.removeAttribute('data-drop-target')
          target = null
        }
        const move = (ev) => {
          if (ev.pointerId !== event.pointerId) return
          if (!dragging && Math.hypot(ev.clientX - x, ev.clientY - y) < 8) return
          ev.preventDefault()
          dragging = true
          lastTap = 0
          title.dataset.dragging = '1'
          clearTarget()
          const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-tmux-cc-pane]')
          if (hit && hit !== rec.wrap && rec.wrap.parentElement?.contains(hit)) {
            target = hit
            target.setAttribute('data-drop-target', '')
          }
        }
        const cleanup = () => {
          clearTarget()
          delete title.dataset.dragging
          window.removeEventListener('pointermove', move, true)
          window.removeEventListener('pointerup', up, true)
          window.removeEventListener('pointercancel', abort, true)
          title.removeEventListener('lostpointercapture', abort)
          window.removeEventListener('blur', cleanup)
          try { title.releasePointerCapture(event.pointerId) } catch { /* gone */ }
          cancel = null
        }
        const up = (ev) => {
          if (ev.pointerId !== event.pointerId) return
          const targetId = target?.dataset.paneId
          cleanup()
          if (dragging) {
            if (targetId) store.send({ type: 'swap', pane: pane.id, target: targetId })
            return
          }
          store.send({ type: 'select', pane: pane.id })
          // A narrow-layout title click must not collapse the toolbar between
          // the two clicks of a zoom gesture. Input remains an explicit action.
          if ((!isNarrowViewport() && event.pointerType !== 'touch') || dockTerminalFocused()) focusPane(rec)
          if (event.pointerType === 'touch') {
            if (lastTap && ev.timeStamp - lastTap < 350) {
              lastTap = 0
              store.send({ type: 'zoom', pane: pane.id })
            } else lastTap = ev.timeStamp
          }
        }
        const abort = (ev) => { if (ev.pointerId === event.pointerId) { lastTap = 0; cleanup() } }
        cancel = cleanup
        try { title.setPointerCapture(event.pointerId) } catch { /* unsupported */ }
        window.addEventListener('pointermove', move, { capture: true, passive: false })
        window.addEventListener('pointerup', up, true)
        window.addEventListener('pointercancel', abort, true)
        title.addEventListener('lostpointercapture', abort)
        window.addEventListener('blur', cleanup)
      }
      title.addEventListener('pointerdown', down)
      return () => {
        if (cancel) cancel()
        title.removeEventListener('pointerdown', down)
      }
    }

    function mountPane(body, pane, store) {
      let rec = store.panes.get(pane.id)
      if (!rec) {
        const wrap = el('div', { 'data-tmux-cc-pane': '', 'data-pane-id': pane.id })
        const title = el('div', { 'data-tmux-cc-ptitle': '', title: t('movePane') })
        const label = el('span', { text: pane.title || pane.id })
        const closer = el('button', {
          type: 'button',
          'data-tmux-cc-pclose': '',
          title: t('kill'),
          onPointerdown: (ev) => {
            ev.stopPropagation()
            if (dockTerminalFocused()) ev.preventDefault()
          },
          onClick: (ev) => { ev.stopPropagation(); store.requestKill(`pane:${pane.id}`, pane.id) },
        })
        closer.append(icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'))
        closer.querySelector('svg')?.setAttribute('width', '12')
        closer.querySelector('svg')?.setAttribute('height', '12')
        title.append(label, closer)
        title.addEventListener('dblclick', (ev) => {
          if (ev.target.closest('button') || title._tmuxPointerType === 'touch' || ev.sourceCapabilities?.firesTouchEvents) return
          ev.preventDefault()
          store.send({ type: 'zoom', pane: pane.id })
        })
        const termHost = el('div', {
          style: {
            position: 'absolute', inset: '0', overflow: 'hidden',
            // Center the sub-cell residual left by font quantization.
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // Never let the browser start a native pan on the terminal: on
            // iOS a native scroll that begins before our handler decides
            // cannot be cancelled mid-gesture, and with the keyboard open it
            // pans the visual viewport instead of the scrollback.
            touchAction: 'none',
          },
        })
        /**
         * Touch events are target-locked to the element under the finger at
         * touchstart — a text span inside xterm's rows. The DOM renderer
         * replaces those rows on every render, and a streaming pane renders
         * constantly; the moment the touched span detaches, the rest of the
         * gesture stops propagating through the ancestor chain and EVERY
         * handler goes blind after the first move. This transparent layer
         * above the terminal is never re-rendered, so it receives complete
         * gestures. It is a child of the shell (not the panning termHost) so
         * grid panning cannot carry it away from under the finger.
         */
        const touchLayer = el('div', { 'data-tmux-cc-touch': '' })
        const termShell = el('div', {
          style: { position: 'relative', flex: '1', minHeight: '0', minWidth: '0' },
        })
        termShell.append(termHost, touchLayer)
        wrap.append(title, termShell)
        wrap.addEventListener('pointerdown', (ev) => {
          if (ev.pointerType === 'touch' || ev.button !== 0 || ev.target.closest('button,[data-tmux-cc-ptitle]')) return
          store.send({ type: 'select', pane: pane.id })
          focusPane(store.panes.get(pane.id))
        })
        body.append(wrap)
        rec = {
          wrap, label, termHost, touchLayer, term: null, seeded: false, fitRaf: null, fitKey: '',
          overflowRaf: null, vPinned: true, panLeft: 0, panTop: 0,
          onTap: () => {
            store.send({ type: 'select', pane: pane.id })
            if (dockTerminalFocused()) focusPane(rec)
          },
          preferredFontSize: store.get().prefs.fontSize,
          mobileFontFloor: store.get().prefs.mobileFontFloor,
        }
        rec.disposeTitle = bindPaneTitle(title, rec, pane, store)
        store.panes.set(pane.id, rec)
        loadXterm().then(() => {
          if (!window.Terminal || rec.term || store.panes.get(pane.id) !== rec) return
          const prefs = store.get().prefs
          const term = new window.Terminal({
            convertEol: true,
            disableStdin: false,
            cursorBlink: prefs.cursorBlink,
            cursorStyle: prefs.cursorStyle,
            scrollback: prefs.scrollbackLines,
            fontFamily: termFontFamily(prefs),
            fontSize: prefs.fontSize,
            theme: termTheme(),
          })
          term.open(termHost)
          rec.term = term
          term.onData((data) => store.send({ type: 'input', pane: pane.id, data }))
          rec.disposeTouch = bindTouchScroll(rec)
          const snap = store.get().snapshot
          const live = snap && snap.panes ? snap.panes.find((p) => p.id === pane.id) : null
          fitPane(rec, live || pane)
          store.seedPane(pane.id)
        }).catch(() => {})
      }
      const snap = store.get().snapshot
      const w = Math.max(snap && snap.cols ? snap.cols : 80, 1)
      const hRows = Math.max(snap && snap.rows ? snap.rows : 24, 1)
      const box = paneVisualBox(pane, w, hRows)
      rec.wrap.style.left = `${(100 * box.left) / w}%`
      rec.wrap.style.top = `${(100 * box.top) / hRows}%`
      rec.wrap.style.width = `${(100 * box.width) / w}%`
      rec.wrap.style.height = `${(100 * box.height) / hRows}%`
      rec.wrap.dataset.active = pane.active ? '1' : '0'
      rec.label.textContent = pane.title || pane.role || pane.id
      const closerEl = rec.wrap.querySelector('[data-tmux-cc-pclose]')
      if (closerEl) {
        closerEl.title = t('kill')
        closerEl.setAttribute('aria-label', closerEl.title)
      }
      fitPane(rec, pane)
    }

    /**
     * The single touch-gesture owner for a pane. It exists because xterm's
     * built-in touch handling only scrolls normal-buffer scrollback and goes
     * completely dead the moment the pane program enables mouse reporting —
     * exactly the TUI/agent-CLI panes a cockpit mirrors, whose transcripts
     * scroll *inside* the program while xterm's own scrollback stays empty.
     * Capture-phase listeners with stopPropagation keep xterm's competing
     * touch handlers out entirely, and drags are translated into synthetic
     * wheel events — the one vocabulary xterm already interprets correctly
     * for every pane state:
     *
     * - mouse reporting on  → encoded wheel reports; the program scrolls
     * - alternate buffer    → arrow keys
     * - normal buffer       → xterm viewport scrollback
     *
     * Vertical drags pan the clipped grid rows first (mobile font floor),
     * then wheel the remainder; horizontal drags pan a grid wider than its
     * box. Both axes follow the finger naturally and release with momentum.
     * preventDefault fires on the very first touchmove: with the on-screen
     * keyboard open, an unprevented first move lets iOS commit a
     * visual-viewport pan, every later event turns non-cancelable, and the
     * drag dies after a few pixels. Gestures hold the paint guard so a
     * snapshot repaint cannot jiggle the pane mid-drag.
     */
    function bindTouchScroll(rec) {
      const host = rec.termHost
      let startY = 0
      let startX = 0
      let lastY = 0
      let lastX = 0
      let lastT = 0
      let velocity = 0 // px/ms along the decided axis, positive = towards newer/right
      let axis = ''    // 'y' pans rows then wheels, 'x' pans a wide grid
      let tracking = false
      let touchId = null
      let guarded = false
      const gestureOwner = {}
      let acc = 0
      let flingRaf = 0
      const stopFling = () => {
        if (flingRaf) { cancelAnimationFrame(flingRaf); flingRaf = 0 }
      }
      const release = () => {
        if (guarded) { guarded = false; gestureGuard.end(gestureOwner) }
      }
      const maxLeft = () => Math.max(0, host.scrollWidth - host.clientWidth)
      const maxTop = () => Math.max(0, host.scrollHeight - host.clientHeight)
      const updatePin = () => {
        const buffer = rec.term?.buffer?.active
        const readingHistory = buffer?.type === 'normal' && buffer.viewportY < buffer.baseY
        rec.vPinned = !readingHistory && maxTop() - host.scrollTop < 2
      }
      const rowHeight = () => {
        const screen = host.querySelector('.xterm-screen')
        return screen && rec.term && rec.term.rows > 0
          ? screen.offsetHeight / rec.term.rows
          : 14
      }
      /**
       * Row-quantized synthetic wheel at the last touch point. Dispatched on
       * the .xterm element, where xterm's wheel listeners resolve mouse
       * reports, alt-buffer arrow keys, or viewport scrolling on their own.
       */
      const sendWheel = (lines) => {
        const target = host.querySelector('.xterm')
        if (!target || !rec.term) return false
        try {
          // Normal buffers have a public row-precise API, independent of
          // mouse-wheel sensitivity and browser wheel-event defaults.
          if (rec.term.buffer?.active.type === 'normal' && rec.term.modes?.mouseTrackingMode === 'none') {
            const before = rec.term.buffer.active.viewportY
            rec.term.scrollLines(lines)
            updatePin()
            return rec.term.buffer.active.viewportY !== before
          }
          // xterm emits ONE mouse report per wheel event, irrespective of
          // delta magnitude. Preserve every row rather than dropping fast moves.
          for (let n = 0; n < Math.abs(lines); n++) {
            target.dispatchEvent(new WheelEvent('wheel', {
              bubbles: false, cancelable: true,
              deltaMode: WheelEvent.DOM_DELTA_LINE,
              deltaY: Math.sign(lines),
              clientX: lastX, clientY: lastY,
            }))
          }
        } catch { return false }
        return true
      }
      const panX = (dx) => {
        const before = host.scrollLeft
        const next = Math.max(0, Math.min(maxLeft(), before + dx))
        if (Math.abs(next - before) < 0.5) return false
        host.scrollLeft = next
        rec.panLeft = host.scrollLeft
        return true
      }
      /** Vertical budget: consume clipped grid rows first, then wheel. */
      const scrollY = (dy) => {
        if (!rec.term) return false
        let used = false
        let rest = dy
        // Returning through scrollback must reach the live screen before
        // panning its clipped bottom rows, or the viewport jumps out of order.
        const buffer = rec.term.buffer?.active
        if (rest > 0 && buffer?.type === 'normal' && buffer.viewportY < buffer.baseY) {
          const lines = Math.min(buffer.baseY - buffer.viewportY, Math.floor(rest / Math.max(rowHeight(), 1)))
          if (lines > 0) { sendWheel(lines); rest -= lines * rowHeight(); used = true }
          if (buffer.viewportY < buffer.baseY) {
            acc += rest
            const extra = Math.trunc(acc / Math.max(rowHeight(), 1))
            if (extra) { sendWheel(extra); acc -= extra * rowHeight() }
            return true
          }
        }
        const before = host.scrollTop
        const clamped = Math.max(0, Math.min(maxTop(), before + rest))
        if (Math.abs(clamped - before) >= 0.5) {
          host.scrollTop = clamped
          rest -= clamped - before
          used = true
        }
        rec.panTop = host.scrollTop
        updatePin()
        if (rest !== 0) {
          acc += rest
          const rowH = Math.max(rowHeight(), 1)
          const lines = Math.trunc(acc / rowH)
          if (lines !== 0) {
            acc -= lines * rowH
            if (!sendWheel(lines)) { acc = 0; return used }
          }
          used = true
        }
        return used
      }
      const cancelGesture = () => {
        tracking = false
        touchId = null
        axis = ''
        velocity = 0
        acc = 0
        stopFling()
        release()
      }
      const onTouchStart = (ev) => {
        ev.stopPropagation()
        cancelGesture()
        if (ev.touches.length !== 1) return
        tracking = true
        touchId = ev.touches[0].identifier
        axis = ''
        acc = 0
        velocity = 0
        startY = lastY = ev.touches[0].clientY
        startX = lastX = ev.touches[0].clientX
        lastT = ev.timeStamp
        if (!guarded) { guarded = true; gestureGuard.begin(gestureOwner) }
      }
      const onTouchMove = (ev) => {
        ev.stopPropagation()
        if (!tracking) return
        if (ev.touches.length !== 1 || ev.touches[0].identifier !== touchId || !rec.term) { cancelGesture(); return }
        // Claim the gesture before any slop maths — see the function comment.
        if (ev.cancelable) ev.preventDefault()
        const y = ev.touches[0].clientY
        const x = ev.touches[0].clientX
        if (!axis) {
          const dy = Math.abs(startY - y)
          const dx = Math.abs(startX - x)
          if (dy < 8 && dx < 8) return
          axis = dx > dy ? 'x' : 'y'
        }
        gestureGuard.touch(gestureOwner)
        // Content follows the finger on both axes.
        const step = axis === 'x' ? lastX - x : lastY - y
        const dt = Math.max(ev.timeStamp - lastT, 1)
        velocity = 0.8 * velocity + 0.2 * (step / dt)
        lastX = x
        lastY = y
        lastT = ev.timeStamp
        if (axis === 'x') panX(step)
        else scrollY(step)
      }
      const onTouchEnd = (ev) => {
        ev.stopPropagation()
        if (!tracking || ev.touches.length !== 0) { cancelGesture(); return }
        tracking = false
        // Suppress compatibility clicks/focus on xterm. A completed tap is
        // handled explicitly and a drag never changes keyboard focus.
        if (ev.cancelable) ev.preventDefault()
        if (!axis && rec.onTap) rec.onTap()
        if (ev.timeStamp - lastT > 100) velocity = 0
        // Momentum: decay the release velocity so long content is reachable.
        // Keep the paint guard through the fling; a snapshot mid-momentum must
        // not move or re-fit the terminal underneath the inertial scroll.
        const apply = axis === 'x' ? panX : scrollY
        if (axis && Math.abs(velocity) > 0.15 && rec.term) {
          let v = velocity
          let prev = performance.now()
          const tick = (now) => {
            flingRaf = 0
            const dt = Math.min(Math.max(now - prev, 1), 48)
            prev = now
            v *= Math.pow(0.94, dt / 16)
            if (Math.abs(v) < 0.05 || !rec.term || !apply(v * dt)) {
              release()
              return
            }
            gestureGuard.touch(gestureOwner)
            flingRaf = requestAnimationFrame(tick)
          }
          flingRaf = requestAnimationFrame(tick)
        } else {
          release()
        }
        velocity = 0
      }
      const onTouchCancel = (ev) => {
        ev.stopPropagation()
        cancelGesture()
      }
      const onWheel = (ev) => {
        if (ev.ctrlKey) return // preserve browser pinch-to-zoom
        ev.preventDefault()
        ev.stopPropagation()
        const remainder = tracking || flingRaf ? 0 : acc
        cancelGesture()
        acc = remainder
        lastX = ev.clientX
        lastY = ev.clientY
        const unit = ev.deltaMode === 1 ? rowHeight() : ev.deltaMode === 2 ? host.clientHeight : 1
        panX(ev.deltaX * unit)
        scrollY(ev.deltaY * unit)
      }
      rec.touchLayer?.addEventListener('wheel', onWheel, { passive: false })
      // The stable touch layer is the primary surface (mobile); the host
      // keeps the same handlers for touch input on desktop-width viewports,
      // where the layer is display:none.
      for (const surface of [rec.touchLayer, host]) {
        if (!surface) continue
        surface.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
        surface.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
        surface.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })
        surface.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true })
      }
      return () => {
        cancelGesture()
        rec.touchLayer?.removeEventListener('wheel', onWheel)
        for (const surface of [rec.touchLayer, host]) {
          if (!surface) continue
          surface.removeEventListener('touchstart', onTouchStart, true)
          surface.removeEventListener('touchmove', onTouchMove, true)
          surface.removeEventListener('touchend', onTouchEnd, true)
          surface.removeEventListener('touchcancel', onTouchCancel, true)
        }
      }
    }

    function prunePanes(store, ids) {
      for (const id of [...store.panes.keys()]) {
        if (!ids.has(id)) store.disposePane(id)
      }
    }

    function paintSashes(body, store) {
      const snap = store.get().snapshot
      const panes = (snap && snap.attached && snap.panes) || []
      const w = Math.max(snap && snap.cols ? snap.cols : 1, 1)
      const h = Math.max(snap && snap.rows ? snap.rows : 1, 1)
      const wanted = new Map()
      for (const pane of panes) {
        const paneBox = paneVisualBox(pane, w, h)
        const right = neighbor(panes, pane, 'x')
        if (right) {
          const rightBox = paneVisualBox(right, w, h)
          const top = Math.max(paneBox.top, rightBox.top)
          const bottom = Math.min(paneBox.top + paneBox.height, rightBox.top + rightBox.height)
          const key = `v:${pane.id}:${right.id}`
          wanted.set(key, {
            dir: 'v', pane, axis: 'x',
            left: `${(100 * rightBox.left) / w}%`,
            top: `${(100 * top) / h}%`,
            height: `${(100 * (bottom - top)) / h}%`,
            width: '',
          })
        }
        const below = neighbor(panes, pane, 'y')
        if (below) {
          const belowBox = paneVisualBox(below, w, h)
          const left = Math.max(paneBox.left, belowBox.left)
          const rightEdge = Math.min(paneBox.left + paneBox.width, belowBox.left + belowBox.width)
          const key = `h:${pane.id}:${below.id}`
          wanted.set(key, {
            dir: 'h', pane, axis: 'y',
            top: `${(100 * belowBox.top) / h}%`,
            left: `${(100 * left) / w}%`,
            width: `${(100 * (rightEdge - left)) / w}%`,
            height: '',
          })
        }
      }
      const existing = new Map()
      body.querySelectorAll('[data-tmux-cc-sash]').forEach((node) => existing.set(node.dataset.key, node))
      for (const [key, node] of existing) {
        if (!wanted.has(key)) node.remove()
      }
      for (const [key, spec] of wanted) {
        let sash = existing.get(key)
        if (!sash) {
          sash = el('div', { 'data-tmux-cc-sash': '', 'data-dir': spec.dir, 'data-key': key })
          bindSash(sash, store, spec.pane, spec.axis, body)
          body.append(sash)
        } else {
          sash._tmuxPane = spec.pane
        }
        sash.style.left = spec.left
        sash.style.top = spec.top
        if (spec.width) sash.style.width = spec.width
        if (spec.height) sash.style.height = spec.height
      }
    }

    function bindSash(sash, store, pane, axis, body) {
      let finishDrag = null
      const startDrag = (event) => {
        if (event.button !== 0 || event.isPrimary === false || finishDrag || document.body.dataset.dshTmuxDragging) return
        if (sash.isConnected === false || body.isConnected === false) return
        const snap = store.get().snapshot
        if (!snap) return
        event.preventDefault()
        const pointerId = event.pointerId
        const live = sash._tmuxPane || pane
        const start = axis === 'x' ? event.clientX : event.clientY
        const startCells = axis === 'x' ? live.width : live.height
        const rect = body.getBoundingClientRect()
        const cell = axis === 'x' ? rect.width / Math.max(snap.cols, 1) : rect.height / Math.max(snap.rows, 1)
        sash.dataset.active = '1'
        document.body.dataset.dshTmuxDragging = '1'
        let lastSent = startCells
        let observer = null
        const finish = () => {
          if (finishDrag !== finish) return
          finishDrag = null
          window.removeEventListener('pointermove', move, true)
          window.removeEventListener('pointerup', end, true)
          window.removeEventListener('pointercancel', end, true)
          window.removeEventListener('blur', finish, true)
          sash.removeEventListener('lostpointercapture', end)
          if (observer) observer.disconnect()
          try { sash.releasePointerCapture?.(pointerId) } catch { /* already released */ }
          delete sash.dataset.active
          delete document.body.dataset.dshTmuxDragging
          // A snapshot received during dragging skipped sash/grid layout. Flush
          // once even if cancellation is followed by lostcapture or pointerup.
          store.setPrefs({})
        }
        const end = (ev) => { if (ev.pointerId === pointerId) finish() }
        const checkConnected = () => {
          if (sash.isConnected === false || body.isConnected === false) finish()
        }
        const move = (ev) => {
          if (ev.pointerId !== pointerId || finishDrag !== finish) return
          if (sash.isConnected === false || body.isConnected === false) { finish(); return }
          const next = Math.max(4, Math.round(startCells + ((axis === 'x' ? ev.clientX : ev.clientY) - start) / Math.max(cell, 1)))
          if (next === lastSent) return
          lastSent = next
          if (axis === 'x') store.send({ type: 'resize-pane', pane: live.id, width: next })
          else store.send({ type: 'resize-pane', pane: live.id, height: next })
        }
        finishDrag = finish
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', end, true)
        window.addEventListener('pointercancel', end, true)
        window.addEventListener('blur', finish, true)
        sash.addEventListener('lostpointercapture', end)
        if (typeof MutationObserver === 'function') {
          observer = new MutationObserver(checkConnected)
          observer.observe(document.body, { childList: true, subtree: true })
        }
        try { sash.setPointerCapture?.(pointerId) } catch { /* window listeners remain the fallback */ }
      }
      sash.addEventListener('pointerdown', startDrag)
      return () => {
        sash.removeEventListener('pointerdown', startDrag)
        if (finishDrag) finishDrag()
      }
    }

    function bindDockResize(grip, store) {
      let finishDrag = null
      const startDrag = (event) => {
        if (event.button !== 0 || event.isPrimary === false || finishDrag || document.body.dataset.dshTmuxDragging) return
        if (isNarrowViewport() || grip.isConnected === false) return
        event.preventDefault()
        const pointerId = event.pointerId
        const side = store.get().prefs.side
        const start = side === 'right' ? event.clientX : event.clientY
        const startSize = clampSize(side, store.get().prefs.size)
        grip.dataset.active = '1'
        document.body.dataset.dshTmuxDragging = '1'
        let observer = null
        const finish = () => {
          if (finishDrag !== finish) return
          finishDrag = null
          window.removeEventListener('pointermove', move, true)
          window.removeEventListener('pointerup', end, true)
          window.removeEventListener('pointercancel', end, true)
          window.removeEventListener('blur', finish, true)
          grip.removeEventListener('lostpointercapture', end)
          if (observer) observer.disconnect()
          try { grip.releasePointerCapture?.(pointerId) } catch { /* already released */ }
          delete grip.dataset.active
          delete document.body.dataset.dshTmuxDragging
          // Keep the latest local size, then flush the deferred grid redraw once.
          store.setPrefs({})
        }
        const end = (ev) => { if (ev.pointerId === pointerId) finish() }
        const checkConnected = () => { if (grip.isConnected === false) finish() }
        const move = (ev) => {
          if (ev.pointerId !== pointerId || finishDrag !== finish) return
          if (isNarrowViewport() || grip.isConnected === false) { finish(); return }
          const next = side === 'right'
            ? startSize + (start - ev.clientX)
            : startSize + (start - ev.clientY)
          // Local-only while dragging; finalized once on release or cancellation.
          store.setLocal({ size: next })
        }
        finishDrag = finish
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', end, true)
        window.addEventListener('pointercancel', end, true)
        window.addEventListener('blur', finish, true)
        grip.addEventListener('lostpointercapture', end)
        if (typeof MutationObserver === 'function') {
          observer = new MutationObserver(checkConnected)
          observer.observe(document.body, { childList: true, subtree: true })
        }
        try { grip.setPointerCapture?.(pointerId) } catch { /* window listeners remain the fallback */ }
      }
      grip.addEventListener('pointerdown', startDrag)
      return () => {
        grip.removeEventListener('pointerdown', startDrag)
        if (finishDrag) finishDrag()
      }
    }

    function fillSelect(select, items, value) {
      const key = items.map((item) => `${item.value}:${item.label}`).join('|')
      if (select.dataset.key !== key) {
        select.dataset.key = key
        select.replaceChildren(...items.map((item) => el('option', { value: item.value, text: item.label })))
      }
      if (value) select.value = value
    }

    /** A native modal keeps terminal input inert while managing host resources. */
    function openManager(host, store, trigger) {
      if (store.closeManager) return
      let closed = false
      let busy = false
      let loaded = false
      let inventory = { sessions: [], clients: [] }
      let sessionKey = ''
      let clientKey = ''
      let editingSession = null
      const selected = new Map()
      const identity = (client) => JSON.stringify([client.name, client.pid, client.created])
      const button = (text, onClick) => el('button', { type: 'button', text, onClick })
      const field = (text, input) => el('label', { 'data-tmux-cc-field': '' }, el('span', { text }), input)
      const dialog = el('dialog', { 'data-tmux-cc-manager': '', 'aria-labelledby': 'tmux-cc-manager-title' })
      const heading = el('h2', { id: 'tmux-cc-manager-title', text: t('manage'), tabIndex: -1, autofocus: true })
      const status = el('div', { role: 'status', 'aria-live': 'polite' })
      const problem = el('div', { role: 'alert', 'data-tmux-cc-manager-error': '' })
      const refresh = button(t('refresh'), () => void run('management'))
      const done = button(t('done'), () => dialog.close())
      const content = el('div', { 'data-tmux-cc-manager-content': '' })
      const nameInput = el('input', { type: 'text', required: true, maxlength: 200, autocomplete: 'off' })
      const cwdInput = el('input', { type: 'text', placeholder: '/home/user/project', autocomplete: 'off' })
      const attachInput = el('input', { type: 'checkbox', checked: true })
      const create = el('button', { type: 'submit', text: t('createSession') })
      const createForm = el('form', { 'data-tmux-cc-create-form': '', onSubmit: (ev) => {
        ev.preventDefault()
        const name = nameInput.value.trim()
        const cwd = cwdInput.value.trim()
        const attach = attachInput.checked
        if (!validName(name, nameInput)) return
        void run('create-session', { name, ...(cwd ? { cwd } : {}) }, () => {
          nameInput.value = ''
          cwdInput.value = ''
          if (attach) {
            store.setPrefs({ session: name })
            store.attach(name)
          }
          status.textContent = t('created')
        })
      } },
        el('h3', { text: t('createSession') }),
        field(t('sessionName'), nameInput), el('p', { text: t('sessionNameHelp') }),
        field(t('startDirectory'), cwdInput), el('p', { text: t('directoryHelp') }),
        el('label', { 'data-tmux-cc-check': '' }, attachInput, t('attachCreated')), create,
      )
      nameInput.addEventListener('input', () => nameInput.setCustomValidity(''))
      const sessionList = el('div', { 'data-tmux-cc-session-list': '' })
      const filter = el('select', { 'aria-label': t('filterClients'), onChange: () => {
        // Hidden selections must never be detached by a misleading filtered view.
        selected.clear()
        clientKey = ''
        renderClients()
      } })
      const selectAll = button(t('selectAll'), () => {
        for (const client of visibleClients()) if (!client.own) selected.set(identity(client), client)
        updateSelection()
      })
      const clear = button(t('clearSelection'), () => { selected.clear(); updateSelection() })
      const detach = button(t('detachSelected'), () => {
        // Capture immutable targets before the dialog; never resolve a new seat
        // from a name after confirmation (the host verifies pid + creation too).
        const targets = [...selected.values()]
        if (!targets.length || busy) return
        const names = targets.map((client) => `${client.name} — ${client.session}`).join('\n')
        if (!window.confirm(`${t('detachConfirm')}\n\n${names}`)) return
        void run('detach-clients', { clients: targets.map(({ name, pid, created }) => ({ name, pid, created })) }, () => {
          selected.clear()
          status.textContent = t('clientsDetached')
        })
      })
      const clientList = el('div', { 'data-tmux-cc-client-list': '' })
      content.append(createForm,
        el('section', {}, el('h3', { text: t('sessions') }), sessionList),
        el('section', {}, el('h3', { text: t('clients') }), el('p', { text: t('clientHelp') }),
          field(t('filterClients'), filter),
          el('div', { 'data-tmux-cc-manager-actions': '', 'data-tmux-cc-client-actions': '' }, selectAll, clear, detach), clientList),
      )
      dialog.append(el('header', {}, heading, done), el('p', { text: t('manageHelp') }),
        el('div', { 'data-tmux-cc-manager-actions': '' }, refresh, status), problem, content)
      host.append(dialog)
      function validName(name, input) {
        input.setCustomValidity(!name || name.length > 200 || /[.:;\x00-\x1f\x7f-\x9f]/.test(name) ? t('sessionNameHelp') : '')
        return input.reportValidity()
      }
      function visibleClients() {
        return inventory.clients.filter((client) => !filter.value || client.session === filter.value)
      }
      function updateSelection() {
        for (const checkbox of clientList.querySelectorAll('input[type="checkbox"]')) {
          checkbox.checked = selected.has(checkbox.dataset.identity)
        }
        updateControls()
      }
      function updateControls() {
        const connected = store.get().connected
        const disabled = busy || !connected
        dialog.setAttribute('aria-busy', String(busy))
        for (const control of content.querySelectorAll('button,input,select')) {
          control.disabled = disabled || !loaded || control.dataset.own === '1'
        }
        refresh.disabled = disabled
        detach.textContent = `${t('detachSelected')} (${selected.size})`
        detach.disabled = disabled || !loaded || selected.size === 0
        clear.disabled = disabled || selected.size === 0
        selectAll.disabled = disabled || !loaded || !visibleClients().some((client) => !client.own)
      }
      function renderSessions() {
        // Preserve an in-progress rename and caret while automatic polling runs.
        if (editingSession !== null) return
        const key = JSON.stringify(inventory.sessions)
        if (sessionKey === key) return
        sessionKey = key
        sessionList.replaceChildren(...inventory.sessions.map((session) => {
          const row = el('div', { 'data-tmux-cc-session-row': '' })
          const attach = button(t('attach'), () => {
            store.setPrefs({ session: session.name })
            store.attach(session.name)
            dialog.close()
          })
          const rename = button(t('rename'), () => {
            editingSession = session.name
            const input = el('input', { type: 'text', value: session.name, required: true, maxlength: 200, autocomplete: 'off' })
            input.addEventListener('input', () => input.setCustomValidity(''))
            const cancel = button(t('cancel'), () => {
              editingSession = null
              sessionKey = ''
              renderSessions()
              updateControls()
              sessionList.querySelector('button')?.focus()
            })
            const form = el('form', { onSubmit: (ev) => {
              ev.preventDefault()
              const newName = input.value.trim()
              if (!validName(newName, input)) return
              void run('rename-session', { session: session.name, newName }, () => {
                if (store.get().prefs.session === session.name) store.setPrefs({ session: newName })
                editingSession = null
                sessionKey = ''
                status.textContent = t('renamed')
              })
            } }, field(t('newSessionName'), input),
              el('div', { 'data-tmux-cc-manager-actions': '' }, el('button', { type: 'submit', text: t('save') }), cancel))
            row.replaceChildren(el('strong', { text: session.name }), form)
            input.focus()
            input.select()
          })
          row.append(el('div', {}, el('strong', { text: session.name }),
            el('p', { text: `${session.windows} ${t('windows')} · ${session.attached} ${t('clients')}` })),
            el('div', { 'data-tmux-cc-manager-actions': '' }, attach, rename))
          return row
        }))
        if (!inventory.sessions.length) sessionList.append(el('p', { text: t('noSessions') }))
      }
      function renderClients() {
        const clients = visibleClients()
        const key = JSON.stringify(clients)
        if (clientKey !== key) {
          clientKey = key
          clientList.replaceChildren(...clients.map((client) => {
            const checkbox = el('input', { type: 'checkbox', 'data-identity': identity(client), 'data-own': client.own ? '1' : '0',
              'aria-label': `${t('selectClient')} ${client.name}`, title: client.own ? t('ownClientHelp') : client.name,
              onChange: () => {
                if (checkbox.checked) selected.set(identity(client), client)
                else selected.delete(identity(client))
                updateControls()
              },
            })
            const kind = client.own ? t('ownClient') : client.control ? t('controlClient') : t('terminalClient')
            const created = client.created > 0 ? new Date(client.created * 1000).toLocaleString() : '—'
            return el('div', { 'data-tmux-cc-client-row': '' },
              el('label', { 'data-tmux-cc-check': '' }, checkbox, el('strong', { text: client.name })),
              el('p', { text: `${client.session} · ${kind} · PID ${client.pid}` }),
              el('p', { text: `${client.tty || '—'} · ${client.term || '—'} · ${client.cols}×${client.rows}` }),
              el('p', { text: `${t('connectedAt')}: ${created}${client.flags.length ? ` · ${client.flags.join(', ')}` : ''}` }),
              client.own ? el('p', { text: t('ownClientHelp') }) : null)
          }))
          if (!clients.length) clientList.append(el('p', { text: t('noClients') }))
        }
        updateSelection()
      }
      function acceptInventory(reply) {
        inventory = reply
        loaded = true
        const live = new Map(inventory.clients.filter((client) => !client.own).map((client) => [identity(client), client]))
        for (const key of selected.keys()) {
          const client = live.get(key)
          if (!client || (filter.value && client.session !== filter.value)) selected.delete(key)
          else selected.set(key, client)
        }
        const value = filter.value
        const sessions = [...new Set([...inventory.sessions.map((session) => session.name), ...inventory.clients.map((client) => client.session)])]
        fillSelect(filter, [{ value: '', label: t('allSessions') }, ...sessions.map((name) => ({ value: name, label: name }))], value)
        if (value && !sessions.includes(value)) { filter.value = ''; selected.clear() }
        renderSessions()
        renderClients()
      }
      async function run(type, fields = {}, onSuccess) {
        if (busy || closed) return
        busy = true
        problem.textContent = ''
        status.textContent = type === 'management' ? t('loading') : t('working')
        updateControls()
        try {
          const reply = await store.managementRequest(type, fields)
          if (closed) return
          status.textContent = ''
          if (onSuccess) onSuccess()
          acceptInventory(reply)
        } catch (err) {
          if (closed) return
          problem.textContent = err.message || String(err)
          status.textContent = ''
          // A failed batch may have detached some seats before one disappeared.
          // Reconcile, but keep the actionable error and all form inputs intact.
          if (type !== 'management') {
            try {
              const reply = await store.managementRequest('management')
              if (!closed) acceptInventory(reply)
            } catch { loaded = false }
          } else loaded = false
        } finally {
          busy = false
          if (!closed) updateControls()
        }
      }
      const position = () => {
        const box = mobileViewportBox()
        dialog.style.maxHeight = `${Math.max(120, box.height - 24)}px`
        dialog.style.top = `${box.top + 12}px`
      }
      const off = store.subscribe(updateControls)
      const poll = window.setInterval(() => {
        // Never disable a field under someone's caret or erase an unread error.
        const typing = dialog.querySelector('input:focus:not([type="checkbox"]), select:focus')
        if (!busy && !editingSession && !typing && !problem.textContent && document.visibilityState !== 'hidden' && store.get().connected) void run('management')
      }, 5000)
      const viewport = window.visualViewport
      window.addEventListener('resize', position)
      viewport?.addEventListener('resize', position)
      viewport?.addEventListener('scroll', position)
      const cleanup = () => {
        if (closed) return
        closed = true
        window.clearInterval(poll)
        window.removeEventListener('resize', position)
        viewport?.removeEventListener('resize', position)
        viewport?.removeEventListener('scroll', position)
        off()
        dialog.remove()
        store.closeManager = null
        if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      }
      dialog.addEventListener('close', cleanup)
      store.closeManager = () => { dialog.close(); cleanup() }
      position()
      dialog.showModal()
      heading.focus({ preventScroll: true })
      void run('management')
    }

    function paint(host, store) {
      const { prefs, snapshot, error, notice } = store.get()
      writePush(prefs)
      setMobileLock(prefs.open && isNarrowViewport())
      applyLiveFont(store)

      let launcher = host.querySelector('[data-tmux-cc-launcher]')
      if (!launcher) {
        launcher = el('button', {
          type: 'button',
          'data-tmux-cc-launcher': '',
          title: t('open'),
          onClick: () => store.setPrefs({ open: !store.get().prefs.open }),
        })
        launcher.append(icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9 9v11"/>'))
        host.append(launcher)
      }
      launcher.title = prefs.open ? t('close') : t('open')
      launcher.setAttribute('aria-label', launcher.title)
      if (prefs.open) launcher.setAttribute('data-open', '')
      else launcher.removeAttribute('data-open')

      let shell = host.querySelector('[data-tmux-cc-shell]')
      if (!prefs.open) {
        if (store.closeManager) store.closeManager()
        store.clearResize()
        if (shell) {
          if (dockTerminalFocused()) document.activeElement.blur()
          store.disposeAllPanes()
          shell.remove()
        }
        return
      }
      if (!shell) {
        shell = el('div', { 'data-tmux-cc-shell': '' })
        const grip = el('div', { 'data-tmux-cc-grip': '', title: 'Resize' })
        bindDockResize(grip, store)
        const bar = el('div', { 'data-tmux-cc-bar': '' })
        bar.addEventListener('pointerdown', (ev) => {
          // Keep controls in place between down/up while the keyboard is up.
          // Focusing a button used to expand the toolbar under the pointer.
          if (ev.target.closest('button') && dockTerminalFocused()) ev.preventDefault()
        })
        const sess = el('select', {
          'data-tmux-cc-session': '',
          title: 'tmux session',
          onChange: (e) => {
            store.setPrefs({ session: e.target.value })
            store.attach(e.target.value)
          },
        })
        const tabs = el('div', { 'data-tmux-cc-tabs': '' })
        const side = el('select', {
          'data-tmux-cc-side': '',
          title: 'Dock side',
          onChange: (e) => store.setPrefs({
            side: e.target.value === 'right' ? 'right' : 'bottom',
            size: e.target.value === 'right' ? 360 : 280,
          }),
        },
          el('option', { value: 'bottom', text: t('bottom') }),
          el('option', { value: 'right', text: t('right') }),
        )
        const mk = (title, path, fn, key) => {
          const b = el('button', { type: 'button', 'data-tmux-cc-icon': '', title, onClick: fn })
          b.append(icon(path))
          b.setAttribute('aria-label', title)
          if (key) b.setAttribute(`data-tmux-cc-${key}`, '')
          return b
        }
        const link = el('button', {
          type: 'button',
          'data-tmux-cc-icon': '',
          'data-tmux-cc-link': '',
          title: t('attach'),
          onClick: () => {
            const state = store.get()
            if (state.snapshot && state.snapshot.attached) store.detach()
            else store.attach(shell.querySelector('[data-tmux-cc-session]').value || state.prefs.session)
          },
        })
        const close = el('button', {
          type: 'button',
          'data-tmux-cc-icon': '',
          'data-tmux-cc-close': '',
          title: t('close'),
          onClick: () => store.setPrefs({ open: false }),
        })
        close.append(icon('<path d="m6 6 12 12"/><path d="m18 6-12 12"/>'))
        close.setAttribute('aria-label', t('close'))
        const actions = el('div', { 'data-tmux-cc-actions': '' })
        const zoom = mk(t('zoom'), '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>', () => store.send({ type: 'zoom' }), 'zoom')
        // Mobile-only (CSS): the on-screen keyboard is summoned explicitly
        // instead of popping up on every pane tap.
        const toggleKbd = () => {
          const focused = document.activeElement
          if (focused && shell.contains(focused) && focused.closest && focused.closest('.xterm')) {
            try { focused.blur() } catch { /* ignore */ }
            return
          }
          const snap = store.get().snapshot
          const live = (snap && snap.panes) || []
          const target = live.find((p) => p.active) || live[0]
          const rec = target ? store.panes.get(target.id) : null
          focusPane(rec)
        }
        const kbd = mk(t('kbd'), '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>', toggleKbd, 'kbd')
        // iOS shows the software keyboard for a programmatic focus() most
        // reliably from inside a touchend handler. Handle the touch directly
        // and swallow the synthetic click that would otherwise double-toggle.
        let kbdTouch = null
        kbd.addEventListener('touchstart', (ev) => {
          kbdTouch = ev.touches.length === 1 ? ev.touches[0] : null
        }, { passive: true })
        kbd.addEventListener('touchcancel', () => { kbdTouch = null }, { passive: true })
        kbd.addEventListener('touchend', (ev) => {
          if (ev.cancelable) ev.preventDefault()
          ev.stopPropagation()
          const end = ev.changedTouches[0]
          const tap = kbdTouch && end && ev.touches.length === 0
            && Math.hypot(end.clientX - kbdTouch.clientX, end.clientY - kbdTouch.clientY) < 8
          kbdTouch = null
          if (tap && !kbd.disabled) toggleKbd()
        }, { passive: false })
        // Mobile-only (CSS): live control over the readable font floor. An
        // 85-column mirror cannot fit a phone at readable sizes, so the
        // reader chooses the fit-vs-legibility tradeoff directly.
        const stepFloor = (delta) => {
          const cur = store.get().prefs.mobileFontFloor || 12
          store.setPrefs({ mobileFontFloor: cur + delta })
        }
        const fontDown = mk(t('fontDown'), '<path d="m4 17 5-12 5 12"/><path d="M5.7 13h6.6"/><path d="M16 12h6"/>', () => stepFloor(-1), 'font-down')
        const fontUp = mk(t('fontUp'), '<path d="m4 17 5-12 5 12"/><path d="M5.7 13h6.6"/><path d="M19 9v6"/><path d="M16 12h6"/>', () => stepFloor(1), 'font-up')
        const manage = mk(t('manage'), '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><path d="M6.5 14v7m-3.5-3.5h7"/><rect x="14" y="14" width="7" height="7" rx="1"/>', () => openManager(host, store, manage), 'manage')
        actions.append(
          manage,
          kbd,
          fontDown,
          fontUp,
          mk(t('splitH'), '<path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>', () => {
            const pane = activePaneId(store)
            if (pane) store.send({ type: 'split', dir: 'h', pane })
          }, 'split-h'),
          mk(t('splitV'), '<path d="M3 12h18"/><rect x="3" y="3" width="18" height="18" rx="2"/>', () => {
            const pane = activePaneId(store)
            if (pane) store.send({ type: 'split', dir: 'v', pane })
          }, 'split-v'),
          zoom,
          // Distinct glyph from the dock's close X: a square with an X inside.
          mk(t('kill'), '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>', () => store.requestKill('active'), 'kill'),
          link,
          side,
        )
        bar.append(sess, tabs, actions, close)
        const err = el('div', { 'data-tmux-cc-error': '' })
        const body = el('div', { 'data-tmux-cc-body': '' })
        shell.append(grip, bar, err, body)
        host.append(shell)
      }
      placeShell(shell, prefs)
      // While the on-screen keyboard is up, vertical space is scarce: CSS
      // collapses the session and window-tab rows on this attribute.
      if (dockTerminalFocused()) shell.dataset.kbd = '1'
      else delete shell.dataset.kbd

      const sessions = (snapshot && snapshot.sessions) || []
      const layouts = (snapshot && snapshot.layouts) || []
      const sessSel = shell.querySelector('[data-tmux-cc-session]')
      const sessionName = (snapshot && snapshot.attached && snapshot.session)
        || prefs.session
        || (snapshot && snapshot.session)
        || ''
      const byValue = new Map()
      for (const s of sessions) byValue.set(s.name, { value: s.name, label: s.name })
      for (const l of layouts) {
        if (!byValue.has(l.session)) byValue.set(l.session, { value: l.session, label: `${l.label} (launch)` })
      }
      if (sessionName && !byValue.has(sessionName)) byValue.set(sessionName, { value: sessionName, label: sessionName })
      const sessionItems = byValue.size > 0
        ? [...byValue.values()]
        : [{ value: '', label: t('noSessions') }]
      fillSelect(sessSel, sessionItems, sessionName)
      const tabs = shell.querySelector('[data-tmux-cc-tabs]')
      // A single window is the norm; showing one tab just burns a row on mobile.
      const allWindows = (snapshot && snapshot.windows) || []
      const windows = allWindows.length > 1 ? allWindows : []
      const tabKey = windows.map((w) => `${w.id}:${w.name}:${w.active}`).join('|')
      if (tabs.dataset.key !== tabKey) {
        tabs.dataset.key = tabKey
        tabs.replaceChildren(...windows.map((win) => el('button', {
          type: 'button',
          'data-tmux-cc-tab': '',
          'data-active': win.active ? '1' : '0',
          text: win.name || win.id,
          onClick: () => store.send({ type: 'select-window', windowId: win.id }),
        })))
      }
      const attached = !!(snapshot && snapshot.attached)
      // Contextual pane actions are dead clicks while detached.
      for (const key of ['split-h', 'split-v', 'zoom', 'kill', 'kbd', 'font-down', 'font-up']) {
        const btn = shell.querySelector(`[data-tmux-cc-${key}]`)
        if (btn) btn.disabled = !attached
      }
      const manageBtn = shell.querySelector('[data-tmux-cc-manage]')
      if (manageBtn) {
        manageBtn.title = t('manage')
        manageBtn.setAttribute('aria-label', manageBtn.title)
      }
      const killBtn = shell.querySelector('[data-tmux-cc-kill]')
      if (killBtn) {
        killBtn.title = t('kill')
        killBtn.setAttribute('aria-label', killBtn.title)
      }
      const zoomBtn = shell.querySelector('[data-tmux-cc-zoom]')
      if (zoomBtn) {
        const zoomed = !!(snapshot && snapshot.zoomed)
        zoomBtn.title = zoomed ? t('unzoom') : t('zoom')
        zoomBtn.setAttribute('aria-label', zoomBtn.title)
        zoomBtn.setAttribute('aria-pressed', zoomed ? 'true' : 'false')
      }
      const linkBtn = shell.querySelector('[data-tmux-cc-link]')
      if (linkBtn) {
        const attached = !!(snapshot && snapshot.attached)
        linkBtn.title = attached ? t('detach') : t('attach')
        linkBtn.setAttribute('aria-pressed', attached ? 'true' : 'false')
        linkBtn.replaceChildren(icon(attached
          ? '<path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/>'
          : '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'))
      }
      const sideSel = shell.querySelector('[data-tmux-cc-side]')
      if (sideSel) sideSel.value = prefs.side === 'right' ? 'right' : 'bottom'
      const err = shell.querySelector('[data-tmux-cc-error]')
      const strip = error || notice || ''
      err.textContent = strip
      err.style.display = strip ? 'block' : 'none'

      const body = shell.querySelector('[data-tmux-cc-body]')
      const panes = (snapshot && snapshot.attached && snapshot.panes) || []
      if (panes.length === 0) {
        store.clearResize()
        prunePanes(store, new Set())
        paintSashes(body, store)
        let empty = body.querySelector('[data-tmux-cc-empty]')
        if (!empty) {
          empty = el('div', { 'data-tmux-cc-empty': '' })
          body.append(empty)
        }
        empty.textContent = !(sessions.length || layouts.length)
          ? t('noSessions')
          : (prefs.session && !sessions.some((s) => s.name === prefs.session) && !attached)
            ? t('sessionGone')
            : t('notAttached')
      } else {
        const empty = body.querySelector('[data-tmux-cc-empty]')
        if (empty) empty.remove()
        const ids = new Set(panes.map((pane) => pane.id))
        for (const pane of panes) mountPane(body, pane, store)
        prunePanes(store, ids)
        if (!document.body.dataset.dshTmuxDragging) paintSashes(body, store)
        reportDockGrid(store, body)
      }
      shell.dataset.sizeMode = (snapshot && snapshot.sizeMode) || 'mirror'
    }

    function exactModifiers(event, ctrl, alt, shift, meta) {
      return !!event.ctrlKey === ctrl
        && !!event.altKey === alt
        && !!event.shiftKey === shift
        && !!event.metaKey === meta
    }

    /** Safe iTerm2 menu equivalents: only exact macOS chords not owned by Chrome/DSH. */
    function resolveItermShortcut(event, isMac, compactSplits) {
      if (!isMac) return null
      const key = String(event.key || '')
      const codeLetter = /^Key([A-Z])$/.exec(String(event.code || ''))
      const lower = codeLetter ? codeLetter[1].toLowerCase() : key.toLowerCase()
      if (exactModifiers(event, true, false, true, true)) {
        if (lower === 'd') return 'detach'
        if (lower === 'n' || lower === 't') return 'new-window'
      }
      if (lower === 'x' && exactModifiers(event, false, true, false, true)) return 'kill'
      if (compactSplits && lower === 'd' && exactModifiers(event, false, true, false, true)) {
        return 'split:h'
      }
      if (exactModifiers(event, false, true, true, true)) {
        if (lower === 'n' || lower === 't') return 'new-window'
        if (compactSplits && lower === 'd') return 'split:v'
        // iTerm's horizontal split is top/bottom (-v); vertical is side-by-side (-h).
        if (lower === 'h') return 'split:v'
        if (lower === 'v') return 'split:h'
      }
      if (exactModifiers(event, false, false, true, true) && key === 'Enter') return 'zoom'
      if (exactModifiers(event, true, false, false, true)) {
        const dirs = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }
        if (dirs[key]) return `resize:${dirs[key]}`
      }
      return null
    }

    function isPrefixKey(event) {
      return exactModifiers(event, true, false, false, false)
        && String(event.key || '').toLowerCase() === 'b'
    }

    function resolvePrefixShortcut(event) {
      if (isPrefixKey(event)) return 'literal-prefix'
      if (event.ctrlKey || event.altKey || event.metaKey) return null
      const key = String(event.key || '')
      const dirs = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }
      if (!event.shiftKey && dirs[key]) return `select:${dirs[key]}`
      if (key === '"') return 'split:v'
      if (key === '%') return 'split:h'
      if (event.shiftKey) return null
      const lower = key.toLowerCase()
      if (lower === 'x') return 'kill'
      if (lower === 'z') return 'zoom'
      if (lower === 'c') return 'new-window'
      if (lower === 'n') return 'window:next'
      if (lower === 'p') return 'window:previous'
      if (lower === 'd') return 'detach'
      if (/^[0-9]$/.test(key)) return `window:${key}`
      return null
    }

    function isMacPlatform() {
      const platform = (navigator.userAgentData && navigator.userAgentData.platform)
        || navigator.platform
        || ''
      return /mac/i.test(platform)
    }

    function activePaneId(store) {
      const snapshot = store.get().snapshot
      const pane = snapshot && snapshot.panes && snapshot.panes.find((item) => item.active)
      return pane && pane.id
    }

    function selectWindowShortcut(store, target) {
      const snapshot = store.get().snapshot
      const windows = snapshot && snapshot.windows
        ? [...snapshot.windows].sort((a, b) => a.index - b.index)
        : []
      if (windows.length === 0) return
      let hit
      if (target === 'next' || target === 'previous') {
        const active = Math.max(0, windows.findIndex((item) => item.active))
        const delta = target === 'next' ? 1 : -1
        hit = windows[(active + delta + windows.length) % windows.length]
      } else {
        const index = Number(target)
        hit = windows.find((item) => item.index === index)
      }
      if (hit) store.send({ type: 'select-window', windowId: hit.id })
    }

    function runShortcut(store, action, focusedPane) {
      if (action.startsWith('select:')) {
        store.send({ type: 'select-dir', dir: action.slice(-1) })
      } else if (action.startsWith('resize:')) {
        const pane = focusedPane || activePaneId(store)
        if (pane) store.send({ type: 'resize-pane-dir', pane, dir: action.slice(-1), amount: 1 })
      } else if (action.startsWith('split:')) {
        const pane = focusedPane || activePaneId(store)
        if (pane) store.send({ type: 'split', dir: action.slice(-1), pane })
      } else if (action.startsWith('window:')) {
        selectWindowShortcut(store, action.slice('window:'.length))
      } else if (action === 'new-window') {
        store.send({ type: 'new-window' })
      } else if (action === 'zoom') {
        store.send(focusedPane ? { type: 'zoom', pane: focusedPane } : { type: 'zoom' })
      } else if (action === 'kill') {
        store.requestKill(focusedPane ? `pane:${focusedPane}` : 'active', focusedPane)
      } else if (action === 'detach') {
        store.detach()
      }
    }

    function bindKeys(host, store) {
      let prefix = false
      let prefixPane = ''
      let prefixTimer = 0
      const macShortcuts = isMacPlatform()
      // Non-focusable parts of the dock (pane titles, empty body) never take
      // keyboard focus, so remember whether the last pointer interaction was
      // inside the dock and let Escape close it in that case too.
      let pointerInDock = false
      const sendLiteralPrefix = (preferredPane) => {
        const pane = preferredPane || activePaneId(store)
        if (pane) store.send({ type: 'input', pane, data: '\u0002' })
      }
      const clearPrefix = (sendLiteral) => {
        window.clearTimeout(prefixTimer)
        prefixTimer = 0
        const wasPending = prefix
        const pane = prefixPane
        prefix = false
        prefixPane = ''
        if (wasPending && sendLiteral) sendLiteralPrefix(pane)
      }
      const armPrefix = (pane) => {
        clearPrefix(false)
        prefix = true
        prefixPane = pane || ''
        prefixTimer = window.setTimeout(() => clearPrefix(true), 1500)
      }
      const onPointer = (event) => {
        pointerInDock = event.target instanceof Node && host.contains(event.target)
        const paneElement = event.target instanceof Element && event.target.closest('[data-tmux-cc-pane]')
        const pointerPane = paneElement && paneElement.dataset.paneId
        const inTerminal = event.target instanceof Element && !!event.target.closest('.xterm')
        if (prefix && (!inTerminal || pointerPane !== prefixPane)) clearPrefix(true)
      }
      window.addEventListener('pointerdown', onPointer, true)
      const swallow = (event) => { event.preventDefault(); event.stopPropagation() }
      const onKey = (event) => {
        if (event.isComposing || event.keyCode === 229) return
        if (!store.get().prefs.open) return
        const target = event.target
        // Native dialog owns Escape, form input, and focus while the dock is inert.
        if (store.closeManager) { clearPrefix(true); return }
        const focusedInDock = target instanceof Node && host.contains(target)
        const terminal = target instanceof Element && target.closest('.xterm')
        const focusedTerminal = !!terminal
        const paneElement = target instanceof Element && target.closest('[data-tmux-cc-pane]')
        const focusedPane = paneElement && paneElement.dataset.paneId
        if (!focusedInDock && !(event.key === 'Escape' && pointerInDock)) {
          clearPrefix(true)
          return
        }
        if (event.key === 'Escape') {
          clearPrefix(true)
          // Never steal Escape from a terminal program or an open dropdown.
          if (target instanceof Element && (target.closest('.xterm') || target.tagName === 'SELECT')) return
          swallow(event)
          store.setPrefs({ open: false })
          return
        }
        // Shortcuts never fire from dock controls, the chat composer, or DSH.
        if (!focusedTerminal) {
          clearPrefix(true)
          return
        }
        const itermAction = resolveItermShortcut(event, macShortcuts, !!store.get().prefs.compactSplitShortcuts)
        if (itermAction) {
          clearPrefix(true)
          swallow(event)
          if (!event.repeat || itermAction.startsWith('resize:')) runShortcut(store, itermAction, focusedPane)
          return
        }
        if (isPrefixKey(event)) {
          swallow(event)
          if (event.repeat) return
          if (prefix) {
            const pendingPane = prefixPane
            clearPrefix(false)
            sendLiteralPrefix(pendingPane || focusedPane)
          } else {
            armPrefix(focusedPane)
          }
          return
        }
        if (!prefix) return
        const action = resolvePrefixShortcut(event)
        const pendingPane = prefixPane
        clearPrefix(false)
        if (!action) {
          // Preserve terminal Ctrl+B semantics for unsupported follow-ups.
          sendLiteralPrefix(pendingPane || focusedPane)
          return
        }
        swallow(event)
        runShortcut(store, action, pendingPane || focusedPane)
      }
      const onBlur = () => clearPrefix(true)
      window.addEventListener('keydown', onKey, true)
      window.addEventListener('blur', onBlur)
      return () => {
        clearPrefix(false)
        window.removeEventListener('keydown', onKey, true)
        window.removeEventListener('pointerdown', onPointer, true)
        window.removeEventListener('blur', onBlur)
      }
    }

    function mountDock(store) {
      injectStyle()
      let host = document.getElementById(ROOT_ID)
      if (!host) {
        host = el('div', { id: ROOT_ID })
        document.body.append(host)
      }
      let redrawFrame = 0
      const redraw = () => {
        redrawFrame = 0
        // A touch scroll in progress owns the screen; repaint when it ends.
        if (store.get().prefs.open && gestureGuard.holding()) { gestureGuard.pending = true; return }
        paint(host, store)
      }
      const scheduleRedraw = () => {
        if (!redrawFrame) redrawFrame = requestAnimationFrame(redraw)
      }
      gestureGuard.onEnd = scheduleRedraw
      const off = store.subscribe(scheduleRedraw)
      const offKeys = bindKeys(host, store)
      // The keyboard toggle mirrors whether a terminal actually has focus
      // (the on-screen keyboard follows that focus on mobile). Evaluation is
      // frame-deferred: focusout fires while focus is still in transit, and
      // acting on that intermediate state flashed the collapsed toolbar rows
      // when refocusing from one pane to another.
      let kbdFrame = 0
      let focusGraceUntil = 0
      const updateKbd = () => {
        if (kbdFrame) return
        kbdFrame = requestAnimationFrame(() => {
          kbdFrame = 0
          syncKbdState()
        })
      }
      const syncKbdState = () => {
        const on = dockTerminalFocused()
        if (on) focusGraceUntil = Date.now() + 1200
        const btn = host.querySelector('[data-tmux-cc-kbd]')
        if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false')
        const shell = host.querySelector('[data-tmux-cc-shell]')
        if (shell) {
          if (on) shell.dataset.kbd = '1'
          else delete shell.dataset.kbd
        }
        // Focusing the xterm textarea makes iOS scroll overflow:hidden
        // ancestors to "reveal" the caret, silently shoving pane content out
        // of its box. Undo that and restore each pane's own pan state.
        if (on) {
          requestAnimationFrame(() => {
            for (const rec of store.panes.values()) {
              if (!rec.wrap) continue
              if (rec.wrap.scrollTop) rec.wrap.scrollTop = 0
              if (rec.wrap.scrollLeft) rec.wrap.scrollLeft = 0
              syncPaneOverflow(rec)
            }
          })
        }
        // The kbd attribute changes toolbar height; re-fit panes to the new box.
        scheduleRedraw()
      }
      window.addEventListener('focusin', updateKbd)
      window.addEventListener('focusout', updateKbd)
      // Belt and braces for the mobile drawer: if anything (a focus reveal, a
      // stray gesture) scrolls the document or the fixed plugin root while the
      // drawer is open, snap it back so the drawer and page stay aligned.
      // Except right after focusing a terminal: fighting Safari's
      // scroll-into-view during the keyboard's opening animation makes iOS
      // abort showing the keyboard. The transform tracker keeps the drawer
      // aligned through that grace window anyway.
      const onStrayScroll = (ev) => {
        if (!isNarrowViewport() || !store.get().prefs.open) return
        if (Date.now() < focusGraceUntil) return
        if (ev.target === document || ev.target === document.documentElement || ev.target === document.body) {
          if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
        } else if (ev.target === host) {
          if (host.scrollTop) host.scrollTop = 0
          if (host.scrollLeft) host.scrollLeft = 0
        }
      }
      window.addEventListener('scroll', onStrayScroll, true)
      // Live theme: DSH flips CSS variables on <html>/<body> attributes, so
      // re-read them and restyle every mounted terminal on change.
      let themeKey = ''
      const applyTheme = () => {
        const theme = termTheme()
        const key = JSON.stringify(theme)
        if (key === themeKey) return
        themeKey = key
        for (const rec of store.panes.values()) {
          if (rec.term) { try { rec.term.options.theme = theme } catch { /* disposed */ } }
        }
      }
      const themeObserver = new MutationObserver(applyTheme)
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode', 'data-color-scheme'] })
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode', 'data-color-scheme'] })
      const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
      if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme)
      const ro = new ResizeObserver(scheduleRedraw)
      const clearLayoutTarget = () => {
        const oldCol = host._tmuxCol
        const oldFrame = host._tmuxFrame
        if (oldCol) {
          try { ro.unobserve(oldCol) } catch { /* detached */ }
          oldCol.removeAttribute('data-dsh-tmux-conversation')
        }
        if (oldFrame) oldFrame.removeAttribute('data-dsh-tmux-frame')
        host._tmuxCol = null
        host._tmuxFrame = null
      }
      const watchCol = () => {
        const col = conversationColumn()
        if (!col || !col.isConnected) {
          if (host._tmuxCol) clearLayoutTarget()
        } else if (col !== host._tmuxCol) {
          clearLayoutTarget()
          const frame = col.parentElement
          host._tmuxCol = col
          host._tmuxFrame = frame
          col.setAttribute('data-dsh-tmux-conversation', '')
          if (frame) frame.setAttribute('data-dsh-tmux-frame', '')
          ro.observe(col)
          scheduleRedraw()
        }
        store.maybeAutoAttach()
      }
      watchCol()
      const onWin = () => scheduleRedraw()
      window.addEventListener('resize', onWin)
      const visualViewport = window.visualViewport
      let viewportPlaceFrame = 0
      const onViewportChange = () => {
        // Moving or resizing the visual viewport must reposition the mobile
        // shell immediately — placeShell only touches transform (and size on
        // real changes), so this stays cheap on every iOS scroll frame and is
        // never deferred behind the gesture paint guard.
        if (!isNarrowViewport() || viewportPlaceFrame) return
        viewportPlaceFrame = requestAnimationFrame(() => {
          viewportPlaceFrame = 0
          const shell = host.querySelector('[data-tmux-cc-shell]')
          if (shell) placeShell(shell, store.get().prefs)
        })
      }
      if (visualViewport) {
        visualViewport.addEventListener('resize', onWin)
        visualViewport.addEventListener('resize', onViewportChange)
        visualViewport.addEventListener('scroll', onViewportChange)
      }
      let locateFrame = 0
      const layoutObserver = new MutationObserver(() => {
        if (locateFrame) return
        locateFrame = requestAnimationFrame(() => { locateFrame = 0; watchCol() })
      })
      const root = document.getElementById('root')
      if (root) layoutObserver.observe(root, { childList: true, subtree: true })
      const timer = window.setInterval(watchCol, 1500)
      store.connect()
      scheduleRedraw()
      return () => {
        off()
        offKeys()
        gestureGuard.onEnd = null
        gestureGuard.pending = false
        gestureGuard.owners.clear()
        clearTimeout(gestureGuard.timer)
        window.removeEventListener('focusin', updateKbd)
        window.removeEventListener('focusout', updateKbd)
        window.removeEventListener('scroll', onStrayScroll, true)
        themeObserver.disconnect()
        if (darkQuery && darkQuery.removeEventListener) darkQuery.removeEventListener('change', applyTheme)
        layoutObserver.disconnect()
        clearLayoutTarget()
        ro.disconnect()
        window.removeEventListener('resize', onWin)
        if (visualViewport) {
          visualViewport.removeEventListener('resize', onWin)
          visualViewport.removeEventListener('resize', onViewportChange)
          visualViewport.removeEventListener('scroll', onViewportChange)
        }
        if (redrawFrame) cancelAnimationFrame(redrawFrame)
        if (viewportPlaceFrame) cancelAnimationFrame(viewportPlaceFrame)
        if (locateFrame) cancelAnimationFrame(locateFrame)
        if (kbdFrame) cancelAnimationFrame(kbdFrame)
        window.clearInterval(timer)
        store.dispose()
        clearPush()
        setMobileLock(false)
        const harnessFont = document.getElementById(HARNESS_FONT_STYLE_ID)
        if (harnessFont) harnessFont.remove()
        const style = document.getElementById(STYLE_ID)
        if (style) style.remove()
        host.remove()
      }
    }

    function registerLocale(ctx) {
      if (!ctx.locale || typeof ctx.locale.register !== 'function') return
      try { return ctx.locale.register(NS, copy) }
      catch {
        try {
          const a = ctx.locale.register(NS, 'zh', copy.zh)
          const b = ctx.locale.register(NS, 'en', copy.en)
          return () => { try { a() } catch {} try { b() } catch {} }
        } catch { /* ignore */ }
      }
    }

    function SettingsPanel({ store, settingsScope }) {
      const [, force] = React.useReducer((x) => x + 1, 0)
      const [fonts, setFonts] = React.useState([])
      React.useEffect(() => store.subscribe(force), [store])
      React.useEffect(() => settingsScope ? settingsScope.subscribe(force) : undefined, [settingsScope])
      const { prefs, snapshot } = store.get()
      const shared = settingsScope ? settingsScope.getSnapshot() : null
      const attached = !!(snapshot && snapshot.attached)
      const paneCount = snapshot && snapshot.panes ? snapshot.panes.length : 0
      const sizeMode = (snapshot && snapshot.sizeMode) || 'mirror'
      const settingsReady = !!(shared && shared.status === 'ready')
      const sizePolicy = (settingsReady && shared.value && shared.value.sizePolicy)
        || (snapshot && snapshot.sizePolicy)
        || 'auto'
      const settingsWritable = !!(settingsReady && shared.writable)
      const labelStyle = { color: 'var(--dsw-alias-label-tertiary)', marginRight: 6 }
      const row = { margin: '4px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' }
      const heading = { margin: '18px 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
      const inputStyle = {
        boxSizing: 'border-box', width: '100%', marginTop: 4, height: 32, padding: '0 10px',
        border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
      }
      const checkStyle = { ...row, display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }
      const buttonStyle = {
        height: 30, padding: '0 14px', cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
      }
      const help = (text) => h('span', {
        style: { display: 'block', marginTop: 4, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
      }, text)
      const loadFonts = () => {
        if (fonts.length || typeof navigator.queryLocalFonts !== 'function') return
        navigator.queryLocalFonts().then((list) => {
          setFonts([...new Set(list.map((f) => f.family))].sort((a, b) => a.localeCompare(b)))
        }).catch(() => {})
      }
      const setSizePolicy = (value) => {
        if (!settingsWritable || !settingsScope) return
        settingsScope.set('sizePolicy', value).catch(() => force())
      }
      return h('div', { style: { padding: 8, maxWidth: 560 } },
        h('p', { style: row },
          h('span', { style: labelStyle }, `${t('state')}:`),
          attached
            ? `${t('attached')} · ${(snapshot && snapshot.session) || prefs.session} · ${paneCount} ${t('panes')} · ${sizeMode}`
            : t('detached')),
        h('p', { style: row },
          h('span', { style: labelStyle }, `${t('viewers')}:`),
          String((snapshot && snapshot.viewers) || 0)),
        h('p', { style: row }, t('hint')),
        h('p', { style: row },
          h('span', { style: labelStyle }, `${t('keys')}:`),
          h('code', { style: { fontFamily: termFontFamily(prefs), fontSize: 12 } }, t('keysHelp'))),
        h('p', { style: row },
          h('span', { style: labelStyle }, `${t('itermKeys')}:`),
          h('code', { style: { fontFamily: termFontFamily(prefs), fontSize: 12 } }, t('itermKeysHelp'))),
        h('p', { style: { ...row, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('shortcutSafety')),

        h('h3', { style: heading }, t('dock')),
        h('label', { style: { ...row, display: 'block' } },
          h('span', { style: labelStyle }, t('dockSide')),
          h('select', {
            value: prefs.side,
            onChange: (ev) => store.setPrefs({ side: ev.target.value, size: ev.target.value === 'right' ? 360 : 280 }),
            style: inputStyle,
          },
          h('option', { value: 'bottom' }, t('bottom')),
          h('option', { value: 'right' }, t('right')))),
        h('button', {
          type: 'button',
          onClick: () => store.setPrefs({ open: !store.get().prefs.open }),
          style: { ...buttonStyle, marginTop: 8 },
        }, prefs.open ? t('close') : t('open')),

        h('h3', { style: heading }, t('terminal')),
        h('label', { style: { ...row, display: 'block' } },
          h('span', { style: labelStyle }, t('font')),
          h('input', {
            type: 'text',
            list: 'dsh-tmux-cc-fonts',
            value: prefs.fontFamily || '',
            placeholder: t('fontPlaceholder'),
            onFocus: loadFonts,
            onChange: (ev) => store.setPrefs({ fontFamily: ev.target.value }),
            style: { ...inputStyle, fontFamily: termFontFamily(prefs) },
          }),
          fonts.length ? h('datalist', { id: 'dsh-tmux-cc-fonts' },
            fonts.map((name) => h('option', { key: name, value: `"${name}", monospace` }))) : null,
          help(t('fontHelp'))),
        h('label', { style: { ...row, display: 'block', marginTop: 10 } },
          h('span', { style: labelStyle }, t('fontSize')),
          h('input', {
            type: 'number', min: 8, max: 32, step: 0.25, value: prefs.fontSize,
            onChange: (ev) => { if (ev.target.value !== '') store.setPrefs({ fontSize: Number(ev.target.value) }) },
            style: inputStyle,
          }),
          help(t('fontSizeHelp'))),
        h('label', { style: { ...row, display: 'block', marginTop: 10 } },
          h('span', { style: labelStyle }, t('cursorStyle')),
          h('select', {
            value: prefs.cursorStyle,
            onChange: (ev) => store.setPrefs({ cursorStyle: ev.target.value }),
            style: inputStyle,
          },
          h('option', { value: 'block' }, t('cursorBlock')),
          h('option', { value: 'underline' }, t('cursorUnderline')),
          h('option', { value: 'bar' }, t('cursorBar')))),
        h('label', { style: checkStyle },
          h('input', {
            type: 'checkbox', checked: !!prefs.cursorBlink,
            onChange: (ev) => store.setPrefs({ cursorBlink: ev.target.checked }), style: { marginTop: 3 },
          }),
          h('span', null, t('cursorBlink'))),
        h('label', { style: { ...row, display: 'block', marginTop: 10 } },
          h('span', { style: labelStyle }, t('scrollback')),
          h('input', {
            type: 'number', min: 0, max: MAX_SCROLLBACK_LINES, step: 100, value: prefs.scrollbackLines,
            onChange: (ev) => { if (ev.target.value !== '') store.setPrefs({ scrollbackLines: Number(ev.target.value) }) },
            style: inputStyle,
          }),
          help(t('scrollbackHelp'))),
        h('label', { style: checkStyle },
          h('input', {
            type: 'checkbox', checked: !!prefs.applyFontToHarness,
            onChange: (ev) => store.setPrefs({ applyFontToHarness: ev.target.checked }), style: { marginTop: 3 },
          }),
          h('span', null, t('fontHarness'))),

        h('h3', { style: heading }, t('behavior')),
        h('label', { style: { ...row, display: 'block' } },
          h('span', { style: labelStyle }, t('sizingPolicy')),
          h('select', {
            value: sizePolicy,
            disabled: !settingsWritable,
            title: settingsWritable ? '' : t('settingsUnavailable'),
            onChange: (ev) => setSizePolicy(ev.target.value === 'mirror' ? 'mirror' : 'auto'),
            style: { ...inputStyle, opacity: settingsWritable ? 1 : 0.65 },
          },
          h('option', { value: 'auto' }, t('sizingAuto')),
          h('option', { value: 'mirror' }, t('sizingMirror'))),
          help(t('sizingHelp')),
          !settingsWritable ? help(t('settingsUnavailable')) : null),
        h('label', { style: checkStyle },
          h('input', {
            type: 'checkbox', checked: !!prefs.confirmKill,
            onChange: (ev) => store.setPrefs({ confirmKill: ev.target.checked }), style: { marginTop: 3 },
          }),
          h('span', null, t('confirmKill'))),
        h('label', { style: checkStyle },
          h('input', {
            type: 'checkbox', checked: !!prefs.compactSplitShortcuts,
            onChange: (ev) => store.setPrefs({ compactSplitShortcuts: ev.target.checked }), style: { marginTop: 3 },
          }),
          h('span', null, t('compactSplit'))),
        help(t('compactSplitHelp')),
        h('button', {
          type: 'button', onClick: () => store.resetPrefs(), style: { ...buttonStyle, marginTop: 12 },
        }, t('reset')),
        help(t('resetHelp')),
      )
    }

    return {
      inject: ['slots', 'locale', 'settingsScope'],
      apply(ctx) {
        const store = createStore()
        const settingsScope = ctx.settingsScope.bind({
          namespace: NS,
          decode(section) {
            if (!section || typeof section !== 'object') return undefined
            const sizePolicy = section.sizePolicy === 'mirror' ? 'mirror' : section.sizePolicy === 'auto' ? 'auto' : undefined
            return sizePolicy ? { sizePolicy } : undefined
          },
        })
        ctx.effect(() => registerLocale(ctx) || (() => {}), 'tmux-cc: dicts')
        try { if (ctx.locale && typeof ctx.locale.bind === 'function') t = ctx.locale.bind(NS) } catch { /* fallback */ }
        ctx.effect(() => mountDock(store), 'tmux-cc: dock')
        try {
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: 'tmux-cc',
            order: 72,
            label: () => t('nav'),
            locale: NS,
          }, () => h(SettingsPanel, { store, settingsScope })))
        } catch (err) {
          console.error('[tmux-cc] settings slot failed', err)
        }
      },
    }
  },
})
