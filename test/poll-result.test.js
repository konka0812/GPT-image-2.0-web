import test from 'node:test'
import assert from 'node:assert/strict'
import { isCompletedImageTask } from '../server/utils.js'

test('isCompletedImageTask accepts statusless image results', () => {
  assert.equal(isCompletedImageTask({ data: [{ b64_json: 'abc' }] }), true)
  assert.equal(isCompletedImageTask({ data: [{ url: 'https://example.com/image.png' }] }), true)
})

test('isCompletedImageTask rejects empty pending task responses', () => {
  assert.equal(isCompletedImageTask({ status: 'running', data: [] }), false)
})
