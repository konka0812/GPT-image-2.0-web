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
