import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { normalizeModel, requireModel } from '../server/settings.js'

test('normalizeModel defaults missing legacy settings to gpt-image-2', () => {
  assert.equal(normalizeModel(undefined), 'gpt-image-2')
  assert.equal(normalizeModel('   '), 'gpt-image-2')
})

test('normalizeModel trims a configured model name', () => {
  assert.equal(normalizeModel('  gpt-image-1  '), 'gpt-image-1')
})

test('requireModel rejects an empty saved model', () => {
  assert.throws(() => requireModel('   '), /请填写模型名称/)
})

test('settings describes the primary provider without a fallback provider', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /默认服务地址：https:\/\/api\.uselg\.top\/v1/)
  assert.doesNotMatch(source, /hk\.testvideo\.site|失败自动切换/)
})
