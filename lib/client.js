window.__ModuleLoader__.load({
  id: 'dsh-tmux-cc',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const NS = 'tmux-cc'
    const STORE_KEY = 'dsh-tmux-cc:dock'
    const ROOT_ID = 'dsh-tmux-cc-root'
    const STYLE_ID = 'dsh-tmux-cc-style'
    const BUFFER_CAP = 400000
    const copy = {
      zh: {
        nav: 'tmux',
        open: '打开 tmux',
        close: '收起',
        pin: '跨会话固定',
        attach: '连接',
        detach: '断开',
        zoom: '放大',
        splitH: '左右分',
        splitV: '上下分',
        kill: '关闭窗格',
        hint: '控制模式座舱，推开对话而不是盖住它。拖分隔条改大小。窗格聚焦后 Ctrl+B 方向键切窗格，x 关闭，z 放大。',
        notAttached: '选择一个 tmux session 并连接。',
        noSessions: '这台机器上没有 tmux session。',
      },
      en: {
        nav: 'tmux',
        open: 'Open tmux',
        close: 'Hide',
        pin: 'Keep across chats',
        attach: 'Attach',
        detach: 'Detach',
        zoom: 'Zoom',
        splitH: 'Split →',
        splitV: 'Split ↓',
        kill: 'Close pane',
        hint: 'Control-mode cockpit. Pushes the conversation. Drag sashes. With a pane focused: Ctrl+B then arrows / x / z / " / %.',
        notAttached: 'Pick a tmux session and attach.',
        noSessions: 'No tmux sessions on this host.',
      },
    }
    let t = (k) => copy.en[k] || k
    const defaultPrefs = { open: false, pinned: true, side: 'bottom', size: 280, session: '' }
    function clampSize(side, size) {
      const raw = Number(size)
      if (!Number.isFinite(raw)) return side === 'right' ? 360 : 280
      if (side === 'right') return Math.max(240, Math.min(Math.floor(window.innerWidth * 0.5), raw))
      return Math.max(180, Math.min(window.innerHeight - 160, raw))
    }

    function loadPrefs() {
      try {
        const raw = localStorage.getItem(STORE_KEY)
        if (!raw) return { ...defaultPrefs }
        const parsed = { ...defaultPrefs, ...JSON.parse(raw) }
        parsed.side = parsed.side === 'right' ? 'right' : 'bottom'
        parsed.size = clampSize(parsed.side, parsed.size)
        return parsed
      } catch { return { ...defaultPrefs } }
    }
    function savePrefs(prefs) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    }

    function createStore() {
      let prefs = loadPrefs()
      let snapshot = null
      let error = ''
      let ws = null
      let lastAttachSent = 0
      let lastGridSent = ''
      let resizeTimer = 0
      const listeners = new Set()
      // pane id -> { wrap, label, termHost, term, seeded, fitRaf }
      const panes = new Map()
      const seeds = new Map()   // pane id -> authoritative capture (reset + write)
      const deltas = new Map()  // pane id -> live output buffered while unmounted
      const emit = () => { for (const fn of listeners) fn() }
      const send = (msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)) }
      const api = {
        panes,
        get: () => ({ prefs, snapshot, error }),
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
        connect() {
          if (ws && (ws.readyState === 0 || ws.readyState === 1)) return
          const proto = location.protocol === 'https:' ? 'wss' : 'ws'
          try { ws = new WebSocket(`${proto}://${location.host}/tmux-cc/ws`) }
          catch (err) { error = String(err); emit(); return }
          ws.onopen = () => {
            send({ type: 'hello' })
            // Re-seed terminals after a reconnect; harmless on first connect.
            send({ type: 'capture' })
          }
          ws.onmessage = (ev) => {
            let msg
            try { msg = JSON.parse(String(ev.data)) } catch { return }
            if (msg.type === 'prefs') {
              // `open` is per-tab UI state (localStorage); everything else syncs.
              const incoming = { ...prefs, ...msg.prefs, open: prefs.open }
              incoming.side = incoming.side === 'right' ? 'right' : 'bottom'
              if (document.body.dataset.dshTmuxDragging) incoming.size = prefs.size
              else incoming.size = clampSize(incoming.side, incoming.size)
              prefs = incoming
              savePrefs(prefs)
            } else if (msg.type === 'snapshot') {
              snapshot = msg.snapshot
              error = msg.snapshot.error || ''
              if (msg.snapshot.attached) lastAttachSent = 0
            } else if (msg.type === 'history') {
              const rec = panes.get(msg.pane)
              if (rec && rec.term) {
                try {
                  rec.term.reset()
                  rec.term.write(msg.data)
                  rec.term.scrollToBottom()
                  rec.seeded = true
                } catch { /* disposed */ }
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
          ws.onclose = () => { ws = null; setTimeout(() => api.connect(), 1500) }
        },
        send,
        attach(session) {
          if (!session) return
          lastAttachSent = Date.now()
          send({ type: 'attach', session })
        },
        /** Attach the preferred session when it is known to exist; retry gently. */
        maybeAutoAttach() {
          if (!snapshot || snapshot.attached || !prefs.open) return
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
         * The host only acts on it in takeover mode (no other seats).
         */
        queueResize(cols, rows) {
          const key = `${cols}x${rows}`
          if (key === lastGridSent) return
          clearTimeout(resizeTimer)
          resizeTimer = setTimeout(() => {
            lastGridSent = key
            send({ type: 'resize', cols, rows })
          }, 400)
        },
        /** Apply prefs locally only (used during drag); setPrefs syncs to the host. */
        setLocal(patch) {
          const next = { ...prefs, ...patch }
          next.side = next.side === 'right' ? 'right' : 'bottom'
          if (patch.size !== undefined || patch.side !== undefined) next.size = clampSize(next.side, next.size)
          prefs = next
          savePrefs(prefs)
          emit()
        },
        setPrefs(patch) {
          api.setLocal(patch)
          send({ type: 'prefs', prefs: prefs })
        },
        /** Seed a freshly-mounted terminal from buffers, or ask the host to capture. */
        seedPane(id) {
          const rec = panes.get(id)
          if (!rec || !rec.term) return
          const seed = seeds.get(id)
          const delta = deltas.get(id)
          seeds.delete(id)
          deltas.delete(id)
          try {
            if (seed) {
              rec.term.reset()
              rec.term.write(seed)
              if (delta) rec.term.write(delta)
              rec.term.scrollToBottom()
              rec.seeded = true
              return
            }
            if (delta) rec.term.write(delta)
          } catch { /* disposed */ }
          if (!rec.seeded) send({ type: 'capture' })
        },
        disposePane(id) {
          const rec = panes.get(id)
          if (!rec) return
          if (rec.fitRaf) { try { cancelAnimationFrame(rec.fitRaf) } catch { /* ignore */ } }
          try { if (rec.term) rec.term.dispose() } catch { /* ignore */ }
          try { rec.wrap.remove() } catch { /* ignore */ }
          panes.delete(id)
        },
        disposeAllPanes() {
          for (const id of [...panes.keys()]) api.disposePane(id)
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

    function injectStyle() {
      const css = `
#${ROOT_ID}{position:fixed;inset:0;pointer-events:none;z-index:25;overflow:hidden}
[data-tmux-cc-launcher]{
  pointer-events:auto;position:absolute;
  top:calc(3px + env(safe-area-inset-top));right:78px;
  width:28px;height:28px;border:none;border-radius:50%;padding:0;
  background:transparent;color:var(--dsw-alias-label-secondary);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  -webkit-app-region:no-drag;
  transition:background var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease),
    color var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
[data-tmux-cc-launcher]:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-tmux-cc-launcher][data-open]{display:none}
[data-tmux-cc-shell]{
  pointer-events:auto;position:absolute;z-index:36;
  display:flex;flex-direction:column;min-width:0;
  background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);
  font:var(--dsw-font-sm, 12px/1.4) ui-sans-serif,system-ui,sans-serif;
}
[data-tmux-cc-shell][data-side="bottom"]{border-top:1px solid var(--dsw-alias-border-l2)}
[data-tmux-cc-shell][data-side="right"]{border-left:1px solid var(--dsw-alias-border-l2)}
[data-tmux-cc-grip]{position:absolute;z-index:5;background:transparent}
[data-tmux-cc-shell][data-side="bottom"] [data-tmux-cc-grip]{left:0;right:0;top:-5px;height:10px;cursor:row-resize}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-grip]{top:0;bottom:0;left:-5px;width:10px;cursor:col-resize}
[data-tmux-cc-grip]:hover,[data-tmux-cc-grip][data-active]{background:var(--dsw-alias-interactive-bg-hover-accent)}
[data-tmux-cc-bar]{
  display:flex;gap:4px;align-items:center;flex-wrap:nowrap;
  padding:3px 40px 3px 8px;height:34px;flex:none;min-width:0;
  border-bottom:1px solid var(--dsw-alias-border-l2);
  -webkit-app-region:no-drag;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-bar]{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  grid-template-rows:28px 28px;
  height:auto;min-height:56px;align-items:center;column-gap:4px;row-gap:0;
  padding:3px 8px 2px;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-session]{
  grid-column:1 / -1;grid-row:1;max-width:none;min-width:0;width:100%;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-tabs]{
  grid-column:1;grid-row:2;flex:none;min-width:0;max-width:none;justify-self:start;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-actions]{
  grid-column:2;grid-row:2;display:flex;gap:2px;align-items:center;min-width:0;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-side]{max-width:72px}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-close]{margin-left:0}
[data-tmux-cc-bar] select{
  background:transparent;color:inherit;border:none;font:inherit;
  max-width:120px;min-width:0;flex:none;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
[data-tmux-cc-shell][data-side="right"] [data-tmux-cc-bar] select{max-width:none}
[data-tmux-cc-icon]{
  width:28px;height:28px;border:none;border-radius:50%;padding:0;cursor:pointer;flex:none;
  background:transparent;color:var(--dsw-alias-label-secondary);
  display:inline-flex;align-items:center;justify-content:center;
  transition:background var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease),
    color var(--ds-transition-duration-slow,160ms) var(--ds-ease-in-out,ease);
}
[data-tmux-cc-icon]:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-tmux-cc-icon][aria-pressed="true"]{color:var(--dsw-alias-brand-primary)}
[data-tmux-cc-close]{margin-left:0}
[data-tmux-cc-error]{color:var(--dsw-alias-state-error-primary,#c00);padding:0 10px 4px}
[data-tmux-cc-body]{position:relative;flex:1;min-height:0;min-width:0;background:var(--dsw-alias-bg-layer-1)}
[data-tmux-cc-pane]{
  position:absolute;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1);
  box-shadow:inset -1px -1px 0 0 var(--dsw-alias-border-l2);
}
[data-tmux-cc-pane][data-active="1"]{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:-1px;z-index:1}
[data-tmux-cc-ptitle]{
  flex:none;display:flex;align-items:center;gap:2px;padding:0 4px 0 8px;height:22px;
  font:var(--dsw-font-xxxs-strong-11, 11px/1.2 ui-sans-serif,system-ui,sans-serif);
  color:var(--dsw-alias-label-secondary);
  border-bottom:1px solid var(--dsw-alias-border-l2);
}
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
[data-tmux-cc-sash]{position:absolute;z-index:3;background:transparent}
[data-tmux-cc-sash][data-dir="v"]{cursor:ew-resize;width:8px;top:0;bottom:0;margin-left:-4px}
[data-tmux-cc-sash][data-dir="h"]{cursor:ns-resize;height:8px;left:0;right:0;margin-top:-4px}
[data-tmux-cc-sash]:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}
[data-tmux-cc-empty]{padding:16px;color:var(--dsw-alias-label-secondary)}
[data-tmux-cc-actions]{display:contents}
[data-tmux-cc-tabs],[data-tmux-cc-pane-tabs]{display:flex;gap:2px;overflow:auto;flex:1;min-width:0;scrollbar-width:thin}
[data-tmux-cc-pane-tabs]{display:none}
[data-tmux-cc-tab]{
  border:none;background:transparent;color:var(--dsw-alias-label-secondary);
  padding:4px 8px;border-radius:8px;cursor:pointer;white-space:nowrap;flex:none;
}
[data-tmux-cc-tab][data-active="1"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-tmux-cc-icon]:focus-visible,[data-tmux-cc-tab]:focus-visible,[data-tmux-cc-bar] select:focus-visible{
  outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;
}
[data-tmux-cc-pane] .xterm,[data-tmux-cc-pane] .xterm-viewport{background:transparent !important}
/* Pairs with NARROW_MAX_WIDTH = 768 in the client logic: 767px is mobile. */
@media (max-width:767px){
  [data-tmux-cc-launcher]{
    top:calc(4px + env(safe-area-inset-top));right:52px;width:36px;height:36px;
  }
  [data-tmux-cc-shell][data-mobile="1"]{
    border:0;max-width:none;min-width:0;padding-bottom:env(safe-area-inset-bottom);
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-grip],
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-sash]{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-bar]{
    display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:44px 40px 40px 48px;
    height:auto;min-height:178px;gap:2px;padding:calc(4px + env(safe-area-inset-top)) 8px 4px;
    border-bottom:1px solid var(--dsw-alias-border-l2);
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-session]{
    grid-column:1;grid-row:1;width:100%;max-width:none;min-height:44px;padding:0 8px;
    border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);font-size:16px;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-tabs]{grid-column:1;grid-row:2}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-pane-tabs]{
    display:flex;grid-column:1;grid-row:3;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-actions]{
    display:flex;grid-column:1;grid-row:4;align-items:center;gap:4px;overflow-x:auto;min-width:0;
    scrollbar-width:none;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-actions]::-webkit-scrollbar{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-icon]{width:44px;height:44px}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-side]{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-tab]{
    min-width:48px;max-width:144px;min-height:40px;padding:8px 10px;
    overflow:hidden;text-overflow:ellipsis;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-pane]{display:none}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-pane][data-active="1"]{
    display:flex;left:0 !important;top:0 !important;width:100% !important;height:100% !important;
    box-shadow:none;outline:none;
  }
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-ptitle]{height:32px;padding-left:10px}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-pclose]{width:32px;height:32px;opacity:1}
  [data-tmux-cc-shell][data-mobile="1"] .xterm-helper-textarea{font-size:16px !important}
  [data-tmux-cc-shell][data-mobile="1"] [data-tmux-cc-empty]{padding:20px}
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
      // Match the layout column by its stable CSS-module local name; the hash
      // prefix changes across builds, the "centerCol" suffix does not.
      return document.querySelector('#root [class*="_centerCol"]')
        || document.querySelector('#root [class*="centerCol"]')
    }

    function sidebarHeight() {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-sidebar-height')) || 0
    }

    const NARROW_MAX_WIDTH = 768
    function isNarrowViewport() {
      return window.innerWidth < NARROW_MAX_WIDTH
    }

    function mobileViewportInsets() {
      const vv = window.visualViewport
      if (!vv) return { top: 0, bottom: 0 }
      const top = Math.max(0, Math.round(vv.offsetTop || 0))
      const rawBottom = window.innerHeight - (vv.height + (vv.offsetTop || 0))
      return { top, bottom: rawBottom > 1 ? Math.max(0, Math.round(rawBottom)) : 0 }
    }

    function writePush(prefs) {
      const col = conversationColumn()
      const open = prefs.open && !isNarrowViewport()
      const size = Math.max(0, prefs.size)
      const side = prefs.side === 'right' ? 'right' : 'bottom'
      const extraH = open && side === 'bottom' ? size : 0
      const extraW = open && side === 'right' ? size : 0
      const sidebarH = sidebarHeight()
      document.documentElement.style.setProperty('--dsh-tmux-height', `${extraH}px`)
      document.documentElement.style.setProperty('--dsh-tmux-width', `${extraW}px`)
      if (!col) return
      col.style.marginBottom = `${sidebarH + extraH}px`
      // A right dock pushes the whole app frame (sidebar + chat + details).
      const frame = col.parentElement
      if (frame) frame.style.marginRight = extraW ? `${extraW}px` : ''
    }

    function placeShell(shell, prefs) {
      const col = conversationColumn()
      const size = prefs.size
      const lift = sidebarHeight()
      shell.dataset.side = prefs.side === 'right' ? 'right' : 'bottom'
      if (isNarrowViewport()) {
        const inset = mobileViewportInsets()
        shell.dataset.mobile = '1'
        Object.assign(shell.style, {
          top: `${inset.top}px`,
          bottom: `${inset.bottom}px`,
          left: '0',
          right: '0',
          width: 'auto',
          height: 'auto',
        })
        return
      }
      delete shell.dataset.mobile
      if (!col || prefs.side === 'right') {
        if (prefs.side === 'right') {
          Object.assign(shell.style, { top: '0', bottom: '0', right: '0', left: 'auto', width: `${size}px`, height: 'auto' })
        } else {
          Object.assign(shell.style, { left: '0', right: '0', bottom: `${lift}px`, top: 'auto', width: 'auto', height: `${size}px` })
        }
        return
      }
      const r = col.getBoundingClientRect()
      Object.assign(shell.style, {
        left: `${r.left}px`,
        width: `${r.width}px`,
        bottom: `${lift}px`,
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
    /** Character cell size of the terminal font at its native 12px. */
    function measureCell(body) {
      if (cellCache) return cellCache
      const probe = el('div', {
        style: {
          position: 'absolute', visibility: 'hidden', whiteSpace: 'pre',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '12px',
        },
        text: 'W'.repeat(40),
      })
      body.append(probe)
      const r = probe.getBoundingClientRect()
      probe.remove()
      if (r.width > 0 && r.height > 0) cellCache = { w: r.width / 40, h: r.height }
      return cellCache || { w: 7.2, h: 14.5 }
    }

    /** Report the dock's native-font grid so the host can size the window when alone. */
    function reportDockGrid(store, body) {
      const rect = body.getBoundingClientRect()
      if (rect.width < 60 || rect.height < 40) return
      // Each stacked row of panes carries a 22px title bar the cells can't use.
      const snap = store.get().snapshot
      const stacks = snap && snap.panes && snap.panes.length
        ? new Set(snap.panes.map((p) => p.top)).size
        : 1
      const cell = measureCell(body)
      const cols = Math.max(20, Math.floor(rect.width / cell.w))
      const rows = Math.max(6, Math.floor((rect.height - 22 * stacks - 2) / cell.h))
      store.queueResize(cols, rows)
    }

    /**
     * Faithful sizing: the terminal grid always matches the tmux pane's cell
     * size (`ignore-size` means tmux will not adapt to us), and the font size
     * adapts so the grid fills the dock cell tightly. The two axes are filled
     * independently: the font fits the tighter axis, then `letterSpacing`
     * (0–2.5px) or `lineHeight` (1–1.35) stretches the slack one, so a pane
     * whose cell-grid aspect differs from its pixel box still fills it. The
     * host centers whatever sub-cell residual remains.
     */
    function fitPane(rec, pane, tries) {
      const term = rec.term
      if (!term) return
      if ((term.cols !== pane.width || term.rows !== pane.height) && pane.width > 1 && pane.height > 1) {
        try { term.resize(pane.width, pane.height) } catch { /* transient */ }
      }
      if (rec.fitRaf) return
      rec.fitRaf = requestAnimationFrame(() => {
        rec.fitRaf = null
        const screen = rec.termHost.querySelector('.xterm-screen')
        if (!screen) return
        const gw = screen.offsetWidth
        const gh = screen.offsetHeight
        const hw = rec.termHost.clientWidth
        const hh = rec.termHost.clientHeight
        const cols = term.cols
        const rows = term.rows
        if (!gw || !gh || !hw || !hh || !cols || !rows) return
        const cur = term.options.fontSize || 12
        const curLs = term.options.letterSpacing || 0
        const curLh = term.options.lineHeight || 1
        // Neutral cell metrics at the current font (spacing/stretch removed).
        const baseW = gw / cols - curLs
        const baseH = gh / rows / curLh
        if (baseW <= 0 || baseH <= 0) return
        // Font that would exactly fit each axis on its own; take the tighter.
        const fW = cur * (hw / (cols * baseW))
        const fH = cur * (hh / (rows * baseH))
        const next = Math.max(5, Math.min(18, Math.round(Math.min(fW, fH) * 4) / 4))
        // Stretch the slack axis so both dimensions fill (within taste caps).
        const predW = baseW * (next / cur)
        const predH = baseH * (next / cur)
        const ls = Math.round(Math.max(0, Math.min(2.5, hw / cols - predW)) * 4) / 4
        const lh = Math.round(Math.max(1, Math.min(1.35, hh / (rows * predH))) * 100) / 100
        if (Math.abs(next - cur) < 0.25 && Math.abs(ls - curLs) < 0.25 && Math.abs(lh - curLh) < 0.02) return
        try {
          term.options.fontSize = next
          term.options.letterSpacing = ls
          term.options.lineHeight = lh
        } catch { /* ignore */ }
        // Metrics shift with the font; converge over a couple of frames.
        if ((tries || 0) < 3) fitPane(rec, pane, (tries || 0) + 1)
      })
    }

    function mountPane(body, pane, store) {
      let rec = store.panes.get(pane.id)
      if (!rec) {
        const wrap = el('div', { 'data-tmux-cc-pane': '', 'data-pane-id': pane.id })
        const title = el('div', { 'data-tmux-cc-ptitle': '' })
        const label = el('span', { text: pane.title || pane.id })
        const closer = el('button', {
          type: 'button',
          'data-tmux-cc-pclose': '',
          title: t('kill'),
          onClick: (ev) => { ev.stopPropagation(); store.send({ type: 'kill', pane: pane.id }) },
        })
        closer.append(icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'))
        closer.querySelector('svg')?.setAttribute('width', '12')
        closer.querySelector('svg')?.setAttribute('height', '12')
        title.append(label, closer)
        const termHost = el('div', {
          style: {
            flex: '1', minHeight: '0', overflow: 'hidden',
            // Center the sub-cell residual left by font quantization.
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        })
        wrap.append(title, termHost)
        wrap.addEventListener('pointerdown', () => {
          store.send({ type: 'select', pane: pane.id })
          const current = store.panes.get(pane.id)
          if (current && current.term) { try { current.term.focus() } catch { /* ignore */ } }
        })
        body.append(wrap)
        rec = { wrap, label, termHost, term: null, seeded: false, fitRaf: null }
        store.panes.set(pane.id, rec)
        loadXterm().then(() => {
          if (!window.Terminal || rec.term || !store.panes.has(pane.id)) return
          const cs = getComputedStyle(document.body)
          const term = new window.Terminal({
            convertEol: true,
            disableStdin: false,
            cursorBlink: true,
            scrollback: 2000,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            theme: {
              background: cs.getPropertyValue('--dsw-alias-bg-layer-1').trim() || '#fff',
              foreground: cs.getPropertyValue('--dsw-alias-label-primary').trim() || '#0f1115',
              cursor: cs.getPropertyValue('--dsw-alias-label-primary').trim() || '#0f1115',
              selectionBackground: cs.getPropertyValue('--dsw-alias-interactive-bg-hover').trim() || '#00000022',
            },
          })
          term.open(termHost)
          rec.term = term
          term.onData((data) => store.send({ type: 'input', pane: pane.id, data }))
          const snap = store.get().snapshot
          const live = snap && snap.panes ? snap.panes.find((p) => p.id === pane.id) : null
          fitPane(rec, live || pane)
          store.seedPane(pane.id)
        }).catch(() => {})
      }
      const snap = store.get().snapshot
      const w = Math.max(snap && snap.cols ? snap.cols : 80, 1)
      const hRows = Math.max(snap && snap.rows ? snap.rows : 24, 1)
      rec.wrap.style.left = `${(100 * pane.left) / w}%`
      rec.wrap.style.top = `${(100 * pane.top) / hRows}%`
      rec.wrap.style.width = `${(100 * pane.width) / w}%`
      rec.wrap.style.height = `${(100 * pane.height) / hRows}%`
      rec.wrap.dataset.active = pane.active ? '1' : '0'
      rec.label.textContent = pane.title || pane.role || pane.id
      fitPane(rec, pane)
    }

    function prunePanes(store, ids) {
      for (const id of [...store.panes.keys()]) {
        if (!ids.has(id)) store.disposePane(id)
      }
    }

    function paintSashes(body, store) {
      if (isNarrowViewport()) {
        body.querySelectorAll('[data-tmux-cc-sash]').forEach((node) => node.remove())
        return
      }
      const snap = store.get().snapshot
      const panes = (snap && snap.attached && snap.panes) || []
      const w = Math.max(snap && snap.cols ? snap.cols : 1, 1)
      const h = Math.max(snap && snap.rows ? snap.rows : 1, 1)
      const wanted = new Map()
      for (const pane of panes) {
        const right = neighbor(panes, pane, 'x')
        if (right) {
          const key = `v:${pane.id}:${right.id}`
          wanted.set(key, {
            dir: 'v', pane, axis: 'x',
            left: `${(100 * (pane.left + pane.width)) / w}%`,
            top: `${(100 * Math.max(pane.top, right.top)) / h}%`,
            height: `${(100 * Math.min(pane.top + pane.height, right.top + right.height) - Math.max(pane.top, right.top)) / h}%`,
            width: '',
          })
        }
        const below = neighbor(panes, pane, 'y')
        if (below) {
          const key = `h:${pane.id}:${below.id}`
          wanted.set(key, {
            dir: 'h', pane, axis: 'y',
            top: `${(100 * (pane.top + pane.height)) / h}%`,
            left: `${(100 * Math.max(pane.left, below.left)) / w}%`,
            width: `${(100 * Math.min(pane.left + pane.width, below.left + below.width) - Math.max(pane.left, below.left)) / w}%`,
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
      const startDrag = (event) => {
        event.preventDefault()
        const snap = store.get().snapshot
        if (!snap) return
        const live = sash._tmuxPane || pane
        const start = axis === 'x' ? event.clientX : event.clientY
        const startCells = axis === 'x' ? live.width : live.height
        const rect = body.getBoundingClientRect()
        const cell = axis === 'x' ? rect.width / Math.max(snap.cols, 1) : rect.height / Math.max(snap.rows, 1)
        document.body.dataset.dshTmuxDragging = '1'
        let lastSent = startCells
        const move = (ev) => {
          const point = ev.touches ? ev.touches[0] : ev
          const next = Math.max(4, Math.round(startCells + ((axis === 'x' ? point.clientX : point.clientY) - start) / Math.max(cell, 1)))
          if (next === lastSent) return
          lastSent = next
          if (axis === 'x') store.send({ type: 'resize-pane', pane: live.id, width: next })
          else store.send({ type: 'resize-pane', pane: live.id, height: next })
        }
        const up = () => {
          window.removeEventListener('pointermove', move, true)
          window.removeEventListener('pointerup', up, true)
          delete document.body.dataset.dshTmuxDragging
        }
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', up, true)
      }
      sash.addEventListener('pointerdown', startDrag)
    }

    function bindDockResize(grip, store) {
      const startDrag = (event) => {
        event.preventDefault()
        if (isNarrowViewport()) return
        const side = store.get().prefs.side
        const start = side === 'right' ? event.clientX : event.clientY
        const startSize = store.get().prefs.size
        grip.dataset.active = '1'
        document.body.dataset.dshTmuxDragging = '1'
        const move = (ev) => {
          const point = ev.touches ? ev.touches[0] : ev
          const next = side === 'right'
            ? startSize + (start - point.clientX)
            : startSize + (start - point.clientY)
          // Local-only while dragging; committed once on release.
          store.setLocal({ size: next })
        }
        const up = () => {
          delete grip.dataset.active
          delete document.body.dataset.dshTmuxDragging
          window.removeEventListener('pointermove', move, true)
          window.removeEventListener('pointerup', up, true)
          store.setPrefs({})
        }
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', up, true)
      }
      grip.addEventListener('pointerdown', startDrag)
    }

    function fillSelect(select, items, value) {
      const key = items.map((item) => `${item.value}:${item.label}`).join('|')
      if (select.dataset.key !== key) {
        select.dataset.key = key
        select.replaceChildren(...items.map((item) => el('option', { value: item.value, text: item.label })))
      }
      if (value) select.value = value
    }

    function paint(host, store) {
      const { prefs, snapshot, error } = store.get()
      writePush(prefs)

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
        if (shell) {
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
        const sess = el('select', {
          'data-tmux-cc-session': '',
          title: 'tmux session',
          onChange: (e) => {
            store.setPrefs({ session: e.target.value })
            store.attach(e.target.value)
          },
        })
        const tabs = el('div', { 'data-tmux-cc-tabs': '' })
        const paneTabs = el('div', { 'data-tmux-cc-pane-tabs': '', 'aria-label': 'tmux panes' })
        const side = el('select', {
          'data-tmux-cc-side': '',
          title: 'Dock side',
          onChange: (e) => store.setPrefs({
            side: e.target.value === 'right' ? 'right' : 'bottom',
            size: e.target.value === 'right' ? 360 : 280,
          }),
        },
          el('option', { value: 'bottom', text: 'Bottom' }),
          el('option', { value: 'right', text: 'Right' }),
        )
        const pin = el('button', {
          type: 'button',
          'data-tmux-cc-icon': '',
          'data-tmux-cc-pin': '',
          title: t('pin'),
          style: { marginLeft: 'auto' },
          onClick: () => store.setPrefs({ pinned: !store.get().prefs.pinned }),
        })
        pin.append(icon('<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1V4H8v2h1z"/>'))
        const mk = (title, path, fn) => {
          const b = el('button', { type: 'button', 'data-tmux-cc-icon': '', title, onClick: fn })
          b.append(icon(path))
          return b
        }
        const link = el('button', {
          type: 'button',
          'data-tmux-cc-icon': '',
          'data-tmux-cc-link': '',
          title: t('attach'),
          onClick: () => {
            const state = store.get()
            if (state.snapshot && state.snapshot.attached) store.send({ type: 'detach' })
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
        const actions = el('div', { 'data-tmux-cc-actions': '' })
        actions.append(
          mk(t('splitH'), '<path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>', () => store.send({ type: 'split', dir: 'h' })),
          mk(t('splitV'), '<path d="M3 12h18"/><rect x="3" y="3" width="18" height="18" rx="2"/>', () => store.send({ type: 'split', dir: 'v' })),
          mk(t('zoom'), '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>', () => store.send({ type: 'zoom' })),
          mk(t('kill'), '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', () => store.send({ type: 'kill' })),
          link,
          side,
          pin,
          close,
        )
        bar.append(sess, tabs, paneTabs, actions)
        const err = el('div', { 'data-tmux-cc-error': '' })
        const body = el('div', { 'data-tmux-cc-body': '' })
        shell.append(grip, bar, err, body)
        host.append(shell)
      }
      placeShell(shell, prefs)

      const sessions = (snapshot && snapshot.sessions) || []
      const layouts = (snapshot && snapshot.layouts) || []
      const sessSel = shell.querySelector('[data-tmux-cc-session]')
      const sessionName = prefs.session || (snapshot && snapshot.session) || ''
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
      const windows = (snapshot && snapshot.windows) || []
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
      const paneTabs = shell.querySelector('[data-tmux-cc-pane-tabs]')
      const paneItems = (snapshot && snapshot.attached && snapshot.panes) || []
      const paneTabKey = paneItems.map((pane) => `${pane.id}:${pane.title}:${pane.active}`).join('|')
      if (paneTabs.dataset.key !== paneTabKey) {
        paneTabs.dataset.key = paneTabKey
        paneTabs.replaceChildren(...paneItems.map((pane) => el('button', {
          type: 'button',
          'data-tmux-cc-tab': '',
          'data-tmux-cc-pane-tab': '',
          'data-active': pane.active ? '1' : '0',
          text: pane.title || pane.role || `Pane ${pane.index}`,
          onClick: () => {
            store.send({ type: 'select', pane: pane.id })
            window.setTimeout(() => {
              const rec = store.panes.get(pane.id)
              if (rec && rec.term) { try { rec.term.focus() } catch { /* ignore */ } }
            }, 100)
          },
        })))
      }
      const pinBtn = shell.querySelector('[data-tmux-cc-pin]')
      if (pinBtn) pinBtn.setAttribute('aria-pressed', prefs.pinned ? 'true' : 'false')
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
      err.textContent = error || ''
      err.style.display = error ? 'block' : 'none'

      const body = shell.querySelector('[data-tmux-cc-body]')
      const panes = (snapshot && snapshot.attached && snapshot.panes) || []
      if (panes.length === 0) {
        prunePanes(store, new Set())
        paintSashes(body, store)
        let empty = body.querySelector('[data-tmux-cc-empty]')
        if (!empty) {
          empty = el('div', { 'data-tmux-cc-empty': '' })
          body.append(empty)
        }
        empty.textContent = (sessions.length || layouts.length) ? t('notAttached') : t('noSessions')
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

    function bindKeys(host, store) {
      let prefix = false
      const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }
      const swallow = (event) => { event.preventDefault(); event.stopPropagation() }
      const onKey = (event) => {
        if (event.isComposing || event.keyCode === 229) return
        if (!store.get().prefs.open) return
        // Only act when the cockpit itself has focus — never steal keys
        // from the chat composer or the rest of the app.
        if (!(event.target instanceof Node) || !host.contains(event.target)) { prefix = false; return }
        if (event.altKey && map[event.key] && !event.ctrlKey && !event.metaKey) {
          swallow(event)
          store.send({ type: 'select-dir', dir: map[event.key] })
          return
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'b' && !event.altKey && !event.metaKey) {
          swallow(event)
          prefix = true
          return
        }
        if (!prefix) return
        prefix = false
        if (map[event.key]) { swallow(event); store.send({ type: 'select-dir', dir: map[event.key] }); return }
        if (event.key.toLowerCase() === 'x') { swallow(event); store.send({ type: 'kill' }); return }
        if (event.key.toLowerCase() === 'z') { swallow(event); store.send({ type: 'zoom' }); return }
        if (event.key === '"') { swallow(event); store.send({ type: 'split', dir: 'v' }); return }
        if (event.key === '%') { swallow(event); store.send({ type: 'split', dir: 'h' }) }
      }
      window.addEventListener('keydown', onKey, true)
      return () => window.removeEventListener('keydown', onKey, true)
    }

    function mountDock(store) {
      injectStyle()
      let host = document.getElementById(ROOT_ID)
      if (!host) {
        host = el('div', { id: ROOT_ID })
        document.body.append(host)
      }
      const redraw = () => paint(host, store)
      const off = store.subscribe(redraw)
      const offKeys = bindKeys(host, store)
      const ro = new ResizeObserver(redraw)
      const watchCol = () => {
        const col = conversationColumn()
        if (col && col !== host._tmuxCol) {
          if (host._tmuxCol) ro.unobserve(host._tmuxCol)
          host._tmuxCol = col
          ro.observe(col)
        }
        store.maybeAutoAttach()
      }
      watchCol()
      let viewportFrame = 0
      const onWin = () => {
        if (viewportFrame) return
        viewportFrame = requestAnimationFrame(() => {
          viewportFrame = 0
          redraw()
        })
      }
      window.addEventListener('resize', onWin)
      const visualViewport = window.visualViewport
      if (visualViewport) {
        visualViewport.addEventListener('resize', onWin)
        visualViewport.addEventListener('scroll', onWin)
      }
      const timer = window.setInterval(watchCol, 1000)
      store.connect()
      redraw()
      return () => {
        off()
        offKeys()
        ro.disconnect()
        window.removeEventListener('resize', onWin)
        if (visualViewport) {
          visualViewport.removeEventListener('resize', onWin)
          visualViewport.removeEventListener('scroll', onWin)
        }
        if (viewportFrame) cancelAnimationFrame(viewportFrame)
        window.clearInterval(timer)
        store.disposeAllPanes()
        writePush({ open: false, side: 'bottom', size: 0 })
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

    function SettingsPanel({ store }) {
      return h('div', { style: { padding: 8, fontSize: 13, lineHeight: 1.6 } },
        h('p', null, t('hint')),
        h('button', { type: 'button', onClick: () => store.setPrefs({ open: true }) }, t('open')),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const store = createStore()
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
          }, () => h(SettingsPanel, { store })))
        } catch (err) {
          console.error('[tmux-cc] settings slot failed', err)
        }
      },
    }
  },
})
