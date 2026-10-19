import test from 'node:test'
import assert from 'node:assert/strict'
import { describeTaskError, formatElapsed, submissionMessage, taskStatusUrl, taskStorageKey, isLinkExpired, upstreamImageLinks } from '../src/task-feedback.js'

test('task feedback formats elapsed time and stable identifiers', () => {
  assert.equal(formatElapsed(65), '1分05秒')
  assert.equal(taskStatusUrl('job-1'), '/api/images/tasks/job-1')
  assert.equal(taskStorageKey('edit'), 'active-image-task:edit')
  assert.match(submissionMessage('job-1'), /任务已提交/)
})

test('task feedback translates common provider errors', () => {
  assert.match(describeTaskError('HTTP 401'), /上游认证/)
  assert.match(describeTaskError('HTTP 403'), /权限或内容策略/)
  assert.match(describeTaskError('The operation was aborted due to timeout'), /处理超时/)
  assert.match(describeTaskError('fetch failed'), /连接上游失败/)
  assert.match(describeTaskError('上游任务已取消'), /已被取消/)
})

test('upstreamImageLinks filters expired and non-direct links', () => {
  const now = new Date('2026-10-14T12:00:00Z').getTime()
  const raw = JSON.stringify([
    { url: 'https://media/a.png', direct: true, expires_at: '2026-10-14T18:00:00Z' },
    { url: 'https://media/b.png', direct: true, expires_at: '2026-10-14T10:00:00Z' },
    { url: 'https://api/c.png', direct: false, expires_at: '2026-10-14T18:00:00Z' }
  ])
  assert.equal(upstreamImageLinks(raw, { now }).length, 2)
  assert.equal(upstreamImageLinks(raw, { directOnly: true, now }).length, 1)
  assert.equal(upstreamImageLinks(raw, { directOnly: true, now })[0].url, 'https://media/a.png')
  assert.deepEqual(upstreamImageLinks('not-json'), [])
  assert.deepEqual(upstreamImageLinks(''), [])
})

test('isLinkExpired handles missing and invalid timestamps', () => {
  const now = new Date('2026-10-14T12:00:00Z').getTime()
  assert.equal(isLinkExpired('2026-10-14T11:00:00Z', now), true)
  assert.equal(isLinkExpired('2026-10-14T13:00:00Z', now), false)
  assert.equal(isLinkExpired('', now), false)
  assert.equal(isLinkExpired('nonsense', now), false)
})
