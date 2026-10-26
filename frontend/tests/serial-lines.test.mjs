import test from 'node:test'
import assert from 'node:assert/strict'
import { SerialLines } from '../src/serial-lines.mjs'

const bytes = text => new TextEncoder().encode(text)
function reader() {
  const lines = [], errors = []
  return { lines, errors, input: new SerialLines(line => lines.push(line), error => errors.push(error)) }
}

test('USB lines survive split reads, CRLF, UTF-8 and multiple frames without changing counters', () => {
  const { lines, errors, input } = reader()
  const raw = '{"sequence":9007199254740993,"text":"ñ"}\r\n'
  const encoded = bytes(raw)
  for (const byte of encoded) input.push(Uint8Array.of(byte), 1)
  input.push(bytes('{}\n\n{}\n'), 2)
  assert.deepEqual(lines, [raw, '{}\n', '{}\n'])
  assert.deepEqual(errors, [])
})

test('oversized and incomplete lines are discarded through the next newline', () => {
  const { lines, errors, input } = reader()
  input.push(bytes('x'.repeat(3000) + '\n{}\n'), 0)
  input.push(bytes('{"partial":'), 10)
  input.expire(2011)
  input.push(bytes('1}\n{"fresh":1}\n'), 2020)
  assert.deepEqual(lines, ['{}\n', '{"fresh":1}\n'])
  assert.equal(errors.length, 2)
})

test('invalid UTF-8 never becomes replacement text in stored data', () => {
  const { lines, errors, input } = reader()
  input.push(Uint8Array.of(255, 10), 1)
  input.push(bytes('{}\n'), 2)
  assert.deepEqual(lines, ['{}\n'])
  assert.equal(errors.length, 1)
})
