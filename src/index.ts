import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { TmuxRuntime } from './runtime.ts'
import { isTrustedApiRequest, isTrustedWebSocketRequest } from './trust.ts'
import { DEFAULT_PREFS, type DockPrefs, type LayoutSpec } from './types.ts'

export const name = 'tmux-cc'
export const inject = ['webServer']

interface HttpReq {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
}

interface HttpRes {
  statusCode: number
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

interface WebServer {
  register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: HttpReq, res: HttpRes) => void | Promise<void> }): () => void
  registerUpgrade(route: { path: string; handler: (req: HttpReq, socket: { destroy(): void }, head: Uint8Array) => void }): () => void
}

interface WebRuntime {
  trustedHosts?: readonly string[]
}

interface PluginConfig {
  tmuxBin?: string
  /** Named session recipes; `launch` runs when the session is missing. */
  layouts?: LayoutSpec[]
}

export function apply(
  ctx: { effect: (fn: () => () => void, name?: string) => void; webServer: WebServer; get: (name: string) => unknown },
  config: PluginConfig = {},
) {
  const runtime = new TmuxRuntime({
    tmuxBin: config.tmuxBin || process.env.DSH_TMUX_BIN || 'tmux',
    layouts: config.layouts,
  })
  const trusted = () => {
    const wr = ctx.get('webRuntime') as WebRuntime | undefined
    return wr?.trustedHosts ?? []
  }
  const fence = (req: HttpReq) => isTrustedApiRequest(req, trusted())
  const wsFence = (req: HttpReq) => isTrustedWebSocketRequest(req, trusted())

  const json = (res: HttpRes, status: number, body: unknown) => {
    const buf = Buffer.from(JSON.stringify(body), 'utf8')
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(buf.length),
    })
    res.end(buf)
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/tmux-cc/status',
    handler: async (req, res) => {
      if (!fence(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      json(res, 200, {
        ok: true,
        plugin: 'dsh-tmux-cc',
        prefs: runtime.getPrefs(),
        snapshot: await runtime.snapshot(),
      })
    },
  }), 'tmux-cc: status')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/tmux-cc/prefs',
    handler: async (req, res) => {
      if (!fence(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      if (req.method === 'GET') return json(res, 200, runtime.getPrefs())
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
      try {
        const body = await readJson(req) as Partial<DockPrefs>
        json(res, 200, runtime.setPrefs(body))
      } catch (err) {
        const status = err instanceof RequestBodyError ? err.status : 400
        json(res, status, { ok: false, error: err instanceof Error ? err.message : 'invalid request body' })
      }
    },
  }), 'tmux-cc: prefs')

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/tmux-cc/vendor',
    handler: (req, res) => {
      if (!fence(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const file = vendorFile(pathname)
      if (file === undefined) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      const type = MIME[extname(file)] ?? 'application/octet-stream'
      res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=3600' })
      createReadStream(file).pipe(res as unknown as NodeJS.WritableStream)
    },
  }), 'tmux-cc: vendor')

  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
  ctx.effect(() => ctx.webServer.registerUpgrade({
    path: '/tmux-cc/ws',
    handler: (req, socket, head) => {
      if (!wsFence(req)) {
        socket.destroy()
        return
      }
      wss.handleUpgrade(req as unknown as IncomingMessage, socket as unknown as Duplex, head as Buffer, (ws) => {
        runtime.bind(wrapWs(ws))
      })
    },
  }), 'tmux-cc: ws')

  ctx.effect(() => () => {
    runtime.dispose()
    wss.close()
  }, 'tmux-cc: dispose')
}

function wrapWs(ws: WebSocket) {
  return {
    send(data: string) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    },
    close(code?: number, reason?: string) {
      ws.close(code, reason)
    },
    on(event: 'message' | 'close', fn: ((data: string) => void) | (() => void)) {
      if (event === 'message') {
        ws.on('message', (data) => (fn as (data: string) => void)(String(data)))
      } else {
        ws.on('close', () => (fn as () => void)())
      }
    },
  }
}

const MAX_JSON_BODY_BYTES = 64 * 1024

class RequestBodyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function readJson(req: HttpReq): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as unknown as AsyncIterable<string | Uint8Array>) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) throw new RequestBodyError(413, 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestBodyError(400, 'invalid JSON')
  }
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
}

function vendorFile(pathname: string): string | undefined {
  const name = pathname.replace(/^\/tmux-cc\/vendor\/?/, '')
  const map: Record<string, string> = {
    'xterm.js': resolvePkg('@xterm/xterm/lib/xterm.js'),
    'xterm.css': resolvePkg('@xterm/xterm/css/xterm.css'),
  }
  const file = map[name]
  if (file === undefined || !existsSync(file) || !statSync(file).isFile()) return undefined
  return file
}

function resolvePkg(spec: string): string {
  try {
    return fileURLToPath(import.meta.resolve(spec))
  } catch {
    return spec
  }
}

export { DEFAULT_PREFS }
