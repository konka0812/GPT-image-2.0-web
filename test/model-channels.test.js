import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { flattenChannels, parseSelectionKey, selectionPayload, resolveOption, appendSelection, availableTiers, ratiosForTier, sizeFor, normalizeSelection } from '../src/model-channels.js'
import { sizeCatalog } from '../src/image-sizes.js'

const channels = [
  {
    id: 'c1',
    name: '站A',
    groups: [
      { id: 'g1', name: '便宜1K分组', models: [{ id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024', '1536x1024', '1024x1536'] }] },
      { id: 'g2', name: '高级分组', models: [{ id: 'm2', name: 'gpt-image-2-pro', sizes: ['3840x2160'] }] }
    ]
  }
]

const partialCatalog = sizeCatalog.filter((entry) => ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '1360x2048'].includes(entry.value))

test('flattenChannels builds selectable options with labels', () => {
  const options = flattenChannels(channels)
  assert.equal(options.length, 2)
  assert.equal(options[0].key, 'c1::g1::m1')
  assert.equal(options[0].label, '站A · 便宜1K分组 · gpt-image-2')
  assert.deepEqual(options[0].sizes, ['1024x1024', '1536x1024', '1024x1536'])
})

test('flattenChannels tolerates missing data', () => {
  assert.deepEqual(flattenChannels(undefined), [])
  assert.deepEqual(flattenChannels([{ id: 'c', name: 'n' }]), [])
  assert.deepEqual(flattenChannels([{ id: 'c', name: 'n', groups: [{ id: 'g', name: 'g' }] }]), [])
})

test('parseSelectionKey splits ids and rejects short keys', () => {
  assert.deepEqual(parseSelectionKey('c1::g1::m1'), { channelId: 'c1', groupId: 'g1', modelId: 'm1' })
  assert.deepEqual(parseSelectionKey(''), { channelId: undefined, groupId: undefined, modelId: undefined })
})

test('selectionPayload returns snake_case request fields', () => {
  assert.deepEqual(selectionPayload('c1::g1::m1'), { channel_id: 'c1', group_id: 'g1', model_id: 'm1' })
})

test('resolveOption falls back to the first option', () => {
  const options = flattenChannels(channels)
  assert.equal(resolveOption(options, 'c1::g2::m2').modelName, 'gpt-image-2-pro')
  assert.equal(resolveOption(options, 'bogus').modelName, 'gpt-image-2')
  assert.equal(resolveOption([], 'x'), null)
})

test('appendSelection only appends resolved ids', () => {
  const form = new Map()
  appendSelection({ append: (name, value) => form.set(name, value) }, 'c1::g1::m1')
  assert.equal(form.get('channel_id'), 'c1')
  assert.equal(form.get('model_id'), 'm1')
  const empty = new Map()
  appendSelection({ append: (name, value) => empty.set(name, value) }, '')
  assert.equal(empty.size, 0)
})

test('availableTiers lists only tiers present in the filtered catalog', () => {
  assert.deepEqual(availableTiers(partialCatalog), ['1K', '2K'])
  assert.deepEqual(availableTiers([]), [])
})

test('ratiosForTier keeps canonical ratio order', () => {
  assert.deepEqual(ratiosForTier(partialCatalog, '1K'), ['1:1', '3:2', '2:3'])
  assert.deepEqual(ratiosForTier(partialCatalog, '2K'), ['1:1', '2:3'])
  assert.deepEqual(ratiosForTier(partialCatalog, '4K'), [])
})

test('sizeFor resolves the catalog entry for a tier and ratio', () => {
  assert.equal(sizeFor(partialCatalog, '2K', '2:3').value, '1360x2048')
  assert.equal(sizeFor(partialCatalog, '2K', '3:2'), null)
})

test('normalizeSelection keeps a supported size untouched', () => {
  assert.deepEqual(normalizeSelection(partialCatalog, '1536x1024', '4K', '16:9'), { tier: '1K', ratio: '3:2', value: '1536x1024' })
})

test('normalizeSelection falls back to the first tier and ratio', () => {
  assert.deepEqual(normalizeSelection(partialCatalog, '3840x2160', '4K', '16:9'), { tier: '1K', ratio: '1:1', value: '1024x1024' })
})

test('normalizeSelection keeps a valid tier and fixes an invalid ratio', () => {
  assert.deepEqual(normalizeSelection(partialCatalog, 'bogus', '2K', '3:2'), { tier: '2K', ratio: '1:1', value: '2048x2048' })
})

test('normalizeSelection handles an empty catalog', () => {
  assert.deepEqual(normalizeSelection([], '1024x1024', '1K', '1:1'), { tier: '', ratio: '', value: '' })
})

test('generation pages use tier and ratio selectors', async () => {
  for (const name of ['Generate.vue', 'EditImage.vue', 'ReferenceGenerate.vue', 'BatchEdit.vue']) {
    const source = await fs.readFile(new URL(`../src/views/${name}`, import.meta.url), 'utf8')
    assert.match(source, /useModelChannels/, `${name} should use model channels`)
    assert.match(source, /tierOptions/, `${name} should render tier options`)
    assert.match(source, /ratioOptions/, `${name} should render ratio options`)
    assert.match(source, /selectionPayload|appendSelection/, `${name} should send the selection`)
  }
})

test('settings page edits image channels', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /image_channels/)
  assert.match(source, /addChannel/)
  assert.match(source, /addGroup/)
  assert.match(source, /addModel/)
})
