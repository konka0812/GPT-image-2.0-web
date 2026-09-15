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

test('server exposes per-record history delete endpoint scoped to user', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /app\.delete\('\/api\/history\/:kind\/:id'/)
  assert.match(source, /kind !== 'generation' && kind !== 'edit'/)
  assert.match(source, /r\.user_id === req\.user\.id/)
})

test('server uses the primary provider as its default without a cross-provider fallback', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /const defaultBaseUrl = 'https:\/\/api\.uselg\.top\/v1'/)
  assert.doesNotMatch(source, /hk\.testvideo\.site/)
  assert.doesNotMatch(source, /callWithFallback/)
})

test('server exposes sanitized model channels for pickers', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /app\.get\('\/api\/model-channels'/)
  assert.match(source, /publicChannels/)
})

test('generation endpoints resolve the selected channel, group and model', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /getImageTarget\(req\.user\.id, req\.body\)/)
  assert.match(source, /resolveSize\(req\.body\.size, settings\.sizes\)/)
  assert.match(source, /当前模型不支持所选尺寸/)
})

test('settings POST validates image channels', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /normalizeChannels\(req\.body\.image_channels\)/)
  assert.match(source, /请至少配置一个完整通道/)
})

test('generation history records keep channel, group and model names', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /channel_name: settings\.channel_name/)
  assert.match(source, /group_name: settings\.group_name/)
  assert.match(source, /model_name: settings\.model_name/)
})
