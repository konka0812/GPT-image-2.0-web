import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { sizeOptions } from '../src/image-sizes.js'
import { sizes } from '../server/utils.js'

const expectedSizes = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '2048x2048',
  '2160x3840',
  '3840x2160',
  '2880x2160',
  '2160x2880',
  '3520x2336',
  '2336x3520'
]

test('frontend exposes labeled size options for all supported sizes', () => {
  assert.equal(sizeOptions.length, expectedSizes.length)
  const values = sizeOptions.map((option) => option.value)
  for (const size of expectedSizes) assert.ok(values.includes(size), `missing ${size}`)
  for (const option of sizeOptions) {
    assert.match(option.label, /\d+:\d+/, `label needs ratio: ${option.value}`)
    assert.ok(option.label.includes('×'), `label needs dimensions: ${option.value}`)
  }
})

test('server validates all supported sizes', () => {
  for (const size of expectedSizes) assert.ok(sizes.includes(size), `server missing ${size}`)
})

test('generation views render labeled size options', async () => {
  for (const name of ['Generate.vue', 'EditImage.vue', 'ReferenceGenerate.vue', 'BatchEdit.vue']) {
    const source = await fs.readFile(new URL(`../src/views/${name}`, import.meta.url), 'utf8')
    assert.match(source, /from '\.\.\/image-sizes\.js'/, `${name} should import shared size options`)
    assert.match(source, /sizeOptions/, `${name} should render sizeOptions`)
  }
})
