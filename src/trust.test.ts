import assert from 'node:assert/strict'
import test from 'node:test'
import { isLoopbackHostname, isTrustedApiRequest, isTrustedWebSocketRequest } from './trust.ts'

function request(headers: Record<string, string>) {
  return { headers }
}

test('recognizes loopback hostnames only', () => {
  assert.equal(isLoopbackHostname('localhost'), true)
  assert.equal(isLoopbackHostname('127.0.0.1'), true)
  assert.equal(isLoopbackHostname('127.255.255.255'), true)
  assert.equal(isLoopbackHostname('[::1]'), true)
  assert.equal(isLoopbackHostname('0.0.0.0'), false)
  assert.equal(isLoopbackHostname('127.0.0.999'), false)
  assert.equal(isLoopbackHostname('example.com'), false)
})

test('allows same-origin loopback requests', () => {
  assert.equal(isTrustedApiRequest(request({
    host: '127.0.0.1:3080',
    origin: 'http://127.0.0.1:3080',
    'sec-fetch-site': 'same-origin',
  }), []), true)
})

test('rejects cross-site and mismatched-origin requests', () => {
  assert.equal(isTrustedApiRequest(request({
    host: 'localhost:3080',
    origin: 'http://localhost:3080',
    'sec-fetch-site': 'cross-site',
  }), []), false)
  assert.equal(isTrustedApiRequest(request({
    host: 'localhost:3080',
    origin: 'http://localhost:9999',
  }), []), false)
})

test('requires an allowed Origin for WebSocket handshakes', () => {
  assert.equal(isTrustedWebSocketRequest(request({ host: 'localhost:3080' }), []), false)
  assert.equal(isTrustedWebSocketRequest(request({
    host: 'localhost:3080',
    origin: 'http://localhost:3080',
  }), []), true)
  assert.equal(isTrustedWebSocketRequest(request({
    host: 'localhost:3080',
    origin: 'http://localhost:9999',
  }), []), false)
})

test('requires non-loopback hosts to be explicitly trusted', () => {
  const req = request({ host: 'dsh.example.test:3080', origin: 'https://dsh.example.test:3080' })
  assert.equal(isTrustedApiRequest(req, []), false)
  assert.equal(isTrustedApiRequest(req, ['dsh.example.test']), true)
  assert.equal(isTrustedApiRequest(req, ['dsh.example.test:3080']), true)
  assert.equal(isTrustedApiRequest(req, ['dsh.example.test:4000']), false)
})
