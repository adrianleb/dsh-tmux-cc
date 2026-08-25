import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeControlOutput } from './decode.ts'
import { parseLayout, paneStyle } from './layout.ts'

test('decode octal control-mode payload', () => {
  assert.equal(decodeControlOutput('hi\\015'), 'hi\r')
  assert.equal(decodeControlOutput('a\\\\b'), 'a\\\\b')
  assert.equal(decodeControlOutput('\\033[0m'), '\x1b[0m')
})

test('parse a nested six-pane tmux layout', () => {
  const raw = 'abcd,120x40,0,0[120x19,0,0{59x19,0,0,0,60x19,60,0,1},120x20,0,20{39x20,0,20,2,39x20,40,20,3,40x20,80,20[40x9,80,20,4,40x10,80,30,5]}]'
  const geo = parseLayout(raw)
  assert.equal(geo.width, 120)
  assert.equal(geo.height, 40)
  assert.equal(geo.panes.length, 6)
  assert.deepEqual(geo.panes[0], { id: '0', left: 0, top: 0, width: 59, height: 19 })
  assert.deepEqual(geo.panes[5], { id: '5', left: 80, top: 30, width: 40, height: 10 })
  const css = paneStyle(geo, geo.panes[0]!)
  assert.equal(css.left, '0%')
  assert.ok(Number.parseFloat(css.width) > 49 && Number.parseFloat(css.width) < 51)
})
