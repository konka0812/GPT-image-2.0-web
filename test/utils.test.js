import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePollUrl } from '../server/utils.js'

test('resolvePollUrl resolves root-relative task URLs against the origin', () => {
  assert.equal(
    resolvePollUrl('https://api.example.com/v1', '/v1/images/tasks/task-1'),
    'https://api.example.com/v1/images/tasks/task-1'
  )
})

test('resolvePollUrl preserves absolute task URLs', () => {
  assert.equal(
    resolvePollUrl('https://api.example.com/v1', 'https://tasks.example.com/task-1'),
    'https://tasks.example.com/task-1'
  )
})
