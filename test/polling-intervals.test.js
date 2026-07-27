import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('all application task polling uses eight second intervals', async () => {
  for (const file of ['../src/use-image-task.js', '../src/views/BatchEdit.vue', '../src/views/History.vue']) {
    const source = await fs.readFile(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /8000/)
  }
})

test('upstream async polling never runs faster than eight seconds', async () => {
  const source = await fs.readFile(new URL('../server/utils.js', import.meta.url), 'utf8')
  assert.match(source, /Math\.max\(8000,/)
})
