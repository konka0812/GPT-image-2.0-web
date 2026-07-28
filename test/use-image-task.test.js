import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('useImageTask busy does not depend on loading', async () => {
  const source = await fs.readFile(new URL('../src/use-image-task.js', import.meta.url), 'utf8')
  assert.match(source, /const busy = computed\(\(\) => submitting\.value\)/)
  assert.doesNotMatch(source, /const busy = computed\(\(\) => submitting\.value \|\| loading\.value\)/)
})
