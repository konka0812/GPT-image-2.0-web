import test from 'node:test'
import assert from 'node:assert/strict'
import { callImageApi, isCompletedImageTask } from '../server/utils.js'

test('isCompletedImageTask accepts statusless image results', () => {
  assert.equal(isCompletedImageTask({ data: [{ b64_json: 'abc' }] }), true)
  assert.equal(isCompletedImageTask({ data: [{ url: 'https://example.com/image.png' }] }), true)
})

test('isCompletedImageTask rejects empty pending task responses', () => {
  assert.equal(isCompletedImageTask({ status: 'running', data: [] }), false)
})

test('callImageApi emits real async task poll counts and statuses', async () => {
  const originalFetch = globalThis.fetch
  const events = []
  let request = 0
  globalThis.fetch = async () => {
    request += 1
    if (request === 1) return new Response(JSON.stringify({ poll_url: '/v1/images/tasks/1', poll_after_ms: 1 }), { status: 202 })
    return new Response(JSON.stringify({ status: 'completed', data: [{ b64_json: 'abc' }] }), { status: 200 })
  }
  try {
    const result = await callImageApi({ baseUrl: 'https://example.com/v1', apiKey: 'key', endpoint: '/images/edits', payload: {}, onStatus: (event) => events.push(event) })
    assert.equal(result.status, 'completed')
    assert.equal(events.find((event) => event.type === 'poll').pollCount, 1)
    assert.equal(events.find((event) => event.type === 'poll-result').status, 'completed')
  } finally {
    globalThis.fetch = originalFetch
  }
})
