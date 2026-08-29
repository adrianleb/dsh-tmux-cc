import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_HISTORY_LINES,
  MAX_HISTORY_BYTES,
  MAX_HISTORY_LINES,
  TmuxControlClient,
  normalizeHistoryLines,
  type ControlTransport,
} from './tmux-client.ts'
import type { SessionInfo } from './types.ts'

class FakeTransport implements ControlTransport {
  writes: string[] = []
  killed = false
  autoRespond: ((line: string) => string | null) | null = null
  private seq = 100
  private dataFn: ((chunk: string) => void) | null = null
  private exitFn: ((code: number | null) => void) | null = null

  write(data: string): void {
    this.writes.push(data)
    if (this.autoRespond === null) return
    for (const line of data.split('\n')) {
      if (line === '') continue
      const body = this.autoRespond(line)
      if (body === null) continue
      const n = this.seq++
      this.feed(`%begin 1 ${n} 1\n${body === '' ? '' : `${body}\n`}%end 1 ${n} 1\n`)
    }
  }

  kill(): void { this.killed = true }
  onData(fn: (chunk: string) => void): void { this.dataFn = fn }
  onStderr(): void { /* unused */ }
  onExit(fn: (code: number | null) => void): void { this.exitFn = fn }
  feed(chunk: string): void { this.dataFn?.(chunk) }
  exit(code: number | null): void { this.exitFn?.(code) }
}

const noSessions = async (): Promise<SessionInfo[]> => []

function scriptedAttach(fake: FakeTransport): void {
  fake.autoRespond = (line) => {
    if (line.includes('client_name')) return 'client-me'
    if (line.startsWith('display-message')) return '@1\tmain\t120\t36\tb25d,120x36,0,0,5\t0\tverify'
    if (line.startsWith('list-panes')) return '%5\t0\tshell\t0\t0\t120\t35\t1\t'
    if (line.startsWith('list-windows')) return '@1\t0\tmain\t1'
    if (line.startsWith('list-clients')) return 'client-me\tattached,focused,control-mode,ignore-size,UTF-8'
    if (line.startsWith('capture-pane')) return 'hello world'
    if (line.startsWith('detach-client')) return ''
    return ''
  }
}

function makeClient(fake: FakeTransport, timeoutMs = 5000): TmuxControlClient {
  const client = new TmuxControlClient('tmux', {
    spawnTransport: () => fake,
    listSessions: noSessions,
    commandTimeoutMs: timeoutMs,
  })
  // EventEmitter treats an unlistened 'error' as fatal; tests assert errors explicitly.
  client.on('error', () => {})
  return client
}

test('attach survives the unsolicited guard block and parses the snapshot', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const attachPromise = client.attach('verify')
  // The guard block (flags=0) plus a notification arrive before any reply.
  fake.feed('%begin 1 99 0\n%end 1 99 0\n%session-changed $1 verify\n')
  await attachPromise
  assert.equal(client.attached, true)
  assert.equal(client.session, 'verify')
  const snap = client.currentSnapshot()
  assert.ok(snap)
  assert.equal(snap.cols, 120)
  assert.equal(snap.rows, 36)
  assert.equal(snap.zoomed, false)
  assert.equal(snap.panes.length, 1)
  assert.equal(snap.panes[0].id, '%5')
  assert.equal(snap.viewers, 0)
  assert.equal(fake.writes.some((line) => line.startsWith('capture-pane')), false)

  const histories = await client.captureVisible(321)
  assert.deepEqual(histories, [{ pane: '%5', data: 'hello world\r\n' }])
  assert.equal(fake.writes.at(-1), "capture-pane -epJ -t '%5' -S -321\n")
  const writeCount = fake.writes.length
  assert.deepEqual(await client.captureVisible(10, '%999'), [])
  assert.equal(fake.writes.length, writeCount)
})

test('history line counts are finite, bounded integers', () => {
  assert.equal(normalizeHistoryLines(undefined), DEFAULT_HISTORY_LINES)
  assert.equal(normalizeHistoryLines(Number.NaN), DEFAULT_HISTORY_LINES)
  assert.equal(normalizeHistoryLines(-1), 0)
  assert.equal(normalizeHistoryLines(12.9), 12)
  assert.equal(normalizeHistoryLines(MAX_HISTORY_LINES + 1), MAX_HISTORY_LINES)
})

test('history resolves before trailing live output from the same transport chunk', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const attachPromise = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await attachPromise

  fake.autoRespond = null
  const outputs: Array<[string, string]> = []
  client.on('output', (pane, data) => outputs.push([pane, data]))
  const capture = client.captureVisible(1, '%5')
  fake.feed('%begin 1 999 1\nseed\n%end 1 999 1\n%output %5 trailing\n')
  assert.deepEqual(await capture, [{ pane: '%5', data: 'seed\r\n' }])
  assert.deepEqual(outputs, [])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(outputs, [['%5', 'trailing']])
})

test('history keeps newest complete lines within the byte budget', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const attachPromise = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await attachPromise

  const lines = Array.from({ length: 100 }, (_, index) => `${String(index).padStart(3, '0')}:${'x'.repeat(9995)}`)
  fake.autoRespond = line => line.startsWith('capture-pane') ? lines.join('\n') : ''
  const captures = await client.captureVisible(MAX_HISTORY_LINES, '%5')
  assert.equal(captures.length, 1)
  assert.ok(Buffer.byteLength(captures[0].data, 'utf8') <= MAX_HISTORY_BYTES)
  assert.match(captures[0].data, /^021:/)
  assert.match(captures[0].data, /099:x+\r\n$/)
})

test('native tmux zoom exposes only the full-window visible pane', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const attachPromise = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await attachPromise

  fake.autoRespond = (line) => {
    if (line.startsWith('resize-pane')) return ''
    if (line.startsWith('display-message')) return '@1\tmain\t120\t36\tbd20,120x36,0,0,8\t1\tverify'
    if (line.startsWith('list-panes')) {
      return [
        '%5\t0\tshell\t0\t0\t59\t17\t0\t',
        '%6\t1\ttests\t60\t0\t60\t17\t0\t',
        '%7\t2\trelease\t0\t18\t59\t18\t0\t',
        '%8\t3\tmetrics\t0\t0\t120\t36\t1\t',
      ].join('\n')
    }
    if (line.startsWith('list-windows')) return '@1\t0\tmain\t1'
    if (line.startsWith('list-clients')) return 'client-me\tattached,control-mode,ignore-size,UTF-8'
    return ''
  }

  await client.zoom('%8')
  const snap = client.currentSnapshot()
  assert.ok(snap)
  assert.equal(snap.zoomed, true)
  assert.equal(snap.panes.length, 1)
  assert.deepEqual(
    { id: snap.panes[0].id, left: snap.panes[0].left, top: snap.panes[0].top, width: snap.panes[0].width, height: snap.panes[0].height },
    { id: '%8', left: 0, top: 0, width: 120, height: 36 },
  )
})

test('viewer counting: self and ignore-size docks excluded, iTerm -CC seats counted', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.autoRespond = (line) => {
    if (line.startsWith('list-clients')) {
      return [
        'client-me\tattached,focused,control-mode,ignore-size,UTF-8',        // us (excluded)
        '/dev/pts/4\tattached,focused,control-mode,wait-exit,pause-after=120,UTF-8', // iTerm -CC seat
        'client-777\tattached,control-mode,ignore-size,UTF-8',               // another dock (excluded)
        '/dev/pts/9\tattached,UTF-8',                                        // plain tmux attach
      ].join('\n')
    }
    return ''
  }
  assert.equal(await client.countViewers(), 2)
})

test('viewer detection failure fails closed even after a known zero', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake, 10)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  assert.equal(client.currentSnapshot()?.viewers, 0)

  const respond = fake.autoRespond
  fake.autoRespond = (line) => line.startsWith('list-clients') ? null : respond?.(line) ?? ''
  await client.refreshSnapshot()
  assert.equal(client.currentSnapshot()?.viewers, 1)
})

test('sizing commands clamp grids and takeover atomically', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.writes = []
  await client.takeOverSize(95.7, 26.2)
  await client.setClientSize(999, 1)
  await client.setIgnoreSize(true)
  assert.deepEqual(fake.writes, [
    'refresh-client -C 95x26 -f !ignore-size\n',
    'refresh-client -C 500x6\n',
    'refresh-client -f ignore-size\n',
  ])
})

test('sendKeys hex-encodes every byte so CR/LF cannot split the protocol', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.writes = []
  await client.sendKeys('%5', 'hi\r')
  assert.equal(fake.writes.length, 1)
  assert.equal(fake.writes[0], "send-keys -t '%5' -H 68 69 0d\n")
})

test('rejects line breaks in tmux target identifiers', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.writes = []
  await assert.rejects(client.sendKeys('%5\nkill-server', 'x'), /invalid tmux target/)
  assert.deepEqual(fake.writes, [])
})

test('sendKeys chunks long input', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.writes = []
  await client.sendKeys('%5', 'x'.repeat(300))
  assert.equal(fake.writes.length, 3)
  for (const w of fake.writes) assert.match(w, /^send-keys -t '%5' -H (78 ?)+\n$/)
})

test('%error on our own command rejects that command', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.autoRespond = null
  const cmd = client.selectPane('%404')
  fake.feed("%begin 1 200 1\ncan't find pane: %404\n%error 1 200 1\n")
  await assert.rejects(cmd, /can't find pane/)
})

test('unsolicited %error surfaces as an error event without touching the queue', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.autoRespond = null
  const errors: string[] = []
  client.on('error', (m) => errors.push(m))
  // e.g. tmux reporting a stray parse error nobody asked for (flags=0)
  fake.feed('%begin 1 300 0\nparse error: whatever\n%error 1 300 0\n')
  const cmd = client.selectPane('%5')
  fake.feed('%begin 1 301 1\n%end 1 301 1\n')
  await cmd
  assert.deepEqual(errors, ['parse error: whatever'])
  client.detach() // cancel the pending debounced refresh before the test ends
})

test('a timed-out command fails alone and later replies stay aligned', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake, 60)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.autoRespond = null
  const slow = client.selectPane('%5')
  await assert.rejects(slow, /timed out/)
  // The reply arrives late; it must consume the dead slot, not the next one.
  const next = client.selectDir('L')
  fake.feed('%begin 1 400 1\n%end 1 400 1\n')
  fake.feed('%begin 1 401 1\n%end 1 401 1\n')
  await next
  client.detach() // cancel the pending debounced refresh before the test ends
})

test('block content lines resembling %end with another number stay in the block', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.autoRespond = null
  const cmd = (client as unknown as { command(line: string): Promise<string> }).command('display-message -p x')
  fake.feed('%begin 1 500 1\n%end 1 111 1\nreal content\n%end 1 500 1\n')
  assert.equal(await cmd, '%end 1 111 1\nreal content')
})

test('%output payloads are octal-decoded', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  const outputs: Array<[string, string]> = []
  client.on('output', (pane, data) => outputs.push([pane, data]))
  fake.feed('%output %5 hi\\015\\012\n')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(outputs, [['%5', 'hi\r\n']])
})

test('unexpected transport exit fails pending commands and emits exit', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  fake.autoRespond = null
  const exits: Array<number | null> = []
  client.on('exit', (code) => exits.push(code))
  const cmd = client.selectPane('%5')
  fake.exit(1)
  await assert.rejects(cmd)
  assert.deepEqual(exits, [1])
  assert.equal(client.attached, false)
})

test('a requested detach never emits exit', async () => {
  const fake = new FakeTransport()
  scriptedAttach(fake)
  const client = makeClient(fake)
  const p = client.attach('verify')
  fake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p
  const exits: Array<number | null> = []
  client.on('exit', (code) => exits.push(code))
  client.detach()
  fake.exit(0)
  assert.deepEqual(exits, [])
  assert.equal(client.attached, false)
  assert.equal(client.session, '')
})

test('stale transport data cannot leak into a new attachment', async () => {
  const oldFake = new FakeTransport()
  scriptedAttach(oldFake)
  const newFake = new FakeTransport()
  scriptedAttach(newFake)
  let first = true
  const client = new TmuxControlClient('tmux', {
    spawnTransport: () => {
      const picked = first ? oldFake : newFake
      first = false
      return picked
    },
    listSessions: noSessions,
  })
  const p1 = client.attach('one')
  oldFake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p1
  const p2 = client.attach('two')
  newFake.feed('%begin 1 99 0\n%end 1 99 0\n')
  await p2
  const outputs: string[] = []
  client.on('output', (pane) => outputs.push(pane))
  oldFake.feed('%output %9 stale\n')
  oldFake.exit(0)
  assert.deepEqual(outputs, [])
  assert.equal(client.attached, true)
})
