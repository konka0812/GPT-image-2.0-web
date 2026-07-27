import test from 'node:test'
import assert from 'node:assert/strict'
import { completeJob, createJob, failJob, getJob, updateJob } from '../server/jobs.js'

test('jobs are visible only to their owner', () => {
  const job = createJob({ userId: 7, kind: 'edit', recordId: 12 })
  assert.equal(getJob(job.id, 7)?.recordId, 12)
  assert.equal(getJob(job.id, 8), null)
})

test('job updates expose real attempts and poll counts', () => {
  const job = createJob({ userId: 9, kind: 'generate', recordId: 22 })
  updateJob(job.id, { phase: 'polling', progressText: '上游处理中', attempt: 2, maxAttempts: 3, pollCount: 4, baseUrl: 'https://example.com/v1' })
  const updated = getJob(job.id, 9)
  assert.equal(updated.phase, 'polling')
  assert.equal(updated.attempt, 2)
  assert.equal(updated.pollCount, 4)
  assert.equal(updated.baseUrl, 'https://example.com/v1')
})

test('jobs support success and failure terminal states', () => {
  const success = createJob({ userId: 1, kind: 'reference', recordId: 31 })
  completeJob(success.id, ['/uploads/result.png'])
  assert.equal(getJob(success.id, 1).status, 'success')
  assert.deepEqual(getJob(success.id, 1).images, ['/uploads/result.png'])

  const failed = createJob({ userId: 1, kind: 'edit', recordId: 32 })
  failJob(failed.id, new Error('HTTP 401'))
  assert.equal(getJob(failed.id, 1).status, 'failed')
  assert.equal(getJob(failed.id, 1).error, 'HTTP 401')
})
