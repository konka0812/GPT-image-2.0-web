import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('history rows avoid thumbnails and expose preview and download actions', async () => {
  const card = await fs.readFile(new URL('../src/components/RecordCard.vue', import.meta.url), 'utf8')
  const history = await fs.readFile(new URL('../src/views/History.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(card, /<img/)
  assert.match(card, /预览/)
  assert.match(card, /download/)
  assert.match(history, /previewImages/)
  assert.match(history, /<img/)
  assert.match(history, /setInterval/)
})

test('history cards expose a delete action', async () => {
  const card = await fs.readFile(new URL('../src/components/RecordCard.vue', import.meta.url), 'utf8')
  const history = await fs.readFile(new URL('../src/views/History.vue', import.meta.url), 'utf8')
  assert.match(card, /删除/)
  assert.match(card, /emit\('delete'\)/)
  assert.match(history, /kind="generation"/)
  assert.match(history, /kind="edit"/)
  assert.match(history, /async function removeRecord/)
})
