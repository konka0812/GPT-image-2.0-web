import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const views = ['Generate.vue', 'EditImage.vue', 'ReferenceGenerate.vue', 'BatchEdit.vue']

for (const name of views) {
  test(`${name} defaults to 3840x2160 and high quality`, async () => {
    const source = await fs.readFile(new URL(`../src/views/${name}`, import.meta.url), 'utf8')
    assert.match(source, /size:\s*'3840x2160'/)
    assert.match(source, /quality:\s*'high'/)
  })
}
