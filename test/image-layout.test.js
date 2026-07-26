import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const widePages = ['Generate.vue', 'ReferenceGenerate.vue']
const fixedPages = ['EditImage.vue', 'BatchEdit.vue']

for (const page of widePages) {
  test(`${page} uses the desktop 3:2 image workflow layout`, async () => {
    const source = await fs.readFile(new URL(`../src/views/${page}`, import.meta.url), 'utf8')
    assert.match(source, /lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/)
    assert.doesNotMatch(source, /lg:grid-cols-\[420px_1fr\]/)
  })
}

for (const page of fixedPages) {
  test(`${page} keeps the fixed 420px controls layout`, async () => {
    const source = await fs.readFile(new URL(`../src/views/${page}`, import.meta.url), 'utf8')
    assert.match(source, /lg:grid-cols-\[420px_1fr\]/)
    assert.doesNotMatch(source, /lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/)
  })
}

test('ReferenceGenerate.vue uses compact horizontal reference previews', async () => {
  const source = await fs.readFile(new URL('../src/views/ReferenceGenerate.vue', import.meta.url), 'utf8')
  assert.match(source, /overflow-x-auto/)
  assert.match(source, /class="flex gap-3"/)
  assert.match(source, /w-28 shrink-0/)
  assert.doesNotMatch(source, /class="grid grid-cols-2 gap-3"/)
})
