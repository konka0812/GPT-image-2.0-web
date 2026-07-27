import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('single generated images fill the result panel and multiple images use a grid', async () => {
  const source = await fs.readFile(new URL('../src/views/Generate.vue', import.meta.url), 'utf8')
  assert.match(source, /images\.length === 1/)
  assert.match(source, /h-full w-full [^"]*object-contain/)
  assert.match(source, /v-else class="grid/)
})

test('edit and reference results fill their available panel without an inner rounded image card', async () => {
  for (const file of ['../src/views/EditImage.vue', '../src/views/ReferenceGenerate.vue']) {
    const source = await fs.readFile(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /h-full w-full [^"]*object-contain/)
    assert.doesNotMatch(source, /<img :src="images\[0\]" class="[^"]*rounded-3xl/)
  }
})
