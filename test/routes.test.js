import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('server does not expose the unused transform endpoint', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\/api\/images\/transform/)
})

test('server exposes the reference image generation endpoint', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /\/api\/images\/reference/)
})

test('server exposes user-owned async image task status', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /\/api\/images\/tasks\/:jobId/)
  assert.match(source, /res\.status\(202\)\.json\(\{ jobId: job\.id \}\)/)
  assert.match(source, /getJob\(req\.params\.jobId, req\.user\.id\)/)
})
