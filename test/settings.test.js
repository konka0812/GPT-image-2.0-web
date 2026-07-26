import test from 'node:test'
import assert from 'node:assert/strict'
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
