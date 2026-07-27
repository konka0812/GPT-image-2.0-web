import test from 'node:test'
import assert from 'node:assert/strict'
import { describeTaskError, formatElapsed, submissionMessage, taskStatusUrl, taskStorageKey } from '../src/task-feedback.js'

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
})
