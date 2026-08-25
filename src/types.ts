/** A named session recipe. `launch` (plus `launchArgs`) is run when the session is missing. */
export interface LayoutSpec {
  id: string
  label: string
  session: string
  /** Launcher executable run when the session does not exist yet. */
  launch?: string
  /** Arguments for `launch`. Defaults to `['--ensure-only']`. */
  launchArgs?: string[]
}

/** The subset of a layout the browser is allowed to see (no host paths). */
export interface LayoutInfo {
  id: string
  label: string
  session: string
}

export interface DockPrefs {
  open: boolean
  pinned: boolean
  side: 'bottom' | 'right'
  size: number
  session: string
}

export const DEFAULT_PREFS: DockPrefs = {
  open: false,
  pinned: true,
  side: 'bottom',
  size: 280,
  session: '',
}

export interface PaneInfo {
  id: string
  index: number
  title: string
  role: string
  left: number
  top: number
  width: number
  height: number
  active: boolean
}

export interface SessionInfo {
  name: string
  attached: number
  windows: number
}

export interface WindowInfo {
  id: string
  index: number
  name: string
  active: boolean
}

export interface Snapshot {
  session: string
  windowId: string
  windowName: string
  cols: number
  rows: number
  attached: boolean
  error?: string
  panes: PaneInfo[]
  sessions: SessionInfo[]
  windows: WindowInfo[]
  layouts: LayoutInfo[]
  /** Other attached clients that participate in window sizing (no ignore-size). */
  viewers: number
  /**
   * mirror: someone else dictates geometry; we render true cells, scaled.
   * takeover: nobody else cares; the dock dictates the window size.
   */
  sizeMode: 'mirror' | 'takeover'
}

export type ClientToHost =
  | { type: 'hello' }
  | { type: 'input'; pane: string; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'select'; pane: string }
  | { type: 'zoom'; pane?: string }
  | { type: 'split'; dir: 'h' | 'v' }
  | { type: 'kill'; pane?: string }
  | { type: 'resize-pane'; pane: string; width?: number; height?: number }
  | { type: 'select-dir'; dir: 'L' | 'R' | 'U' | 'D' }
  | { type: 'attach'; session: string }
  | { type: 'select-window'; windowId: string }
  | { type: 'detach' }
  | { type: 'refresh' }
  | { type: 'capture' }
  | { type: 'prefs'; prefs: Partial<DockPrefs> }

export type HostToClient =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'output'; pane: string; data: string }
  | { type: 'history'; pane: string; data: string }
  | { type: 'prefs'; prefs: DockPrefs }
  | { type: 'error'; message: string }
