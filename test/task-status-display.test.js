import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('task status distinguishes frontend queries from upstream async polling', async () => {
  const status = await fs.readFile(new URL('../src/components/TaskStatus.vue', import.meta.url), 'utf8')
  const polling = await fs.readFile(new URL('../src/use-image-task.js', import.meta.url), 'utf8')
  assert.match(status, /页面状态查询/)
  assert.match(status, /上游任务查询/)
  assert.match(status, /同步等待响应/)
  assert.match(polling, /queryCount\.value \+= 1/)
})
