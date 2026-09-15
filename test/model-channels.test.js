import test from 'node:test'
import assert from 'node:assert/strict'
import { flattenChannels, parseSelectionKey, selectionPayload, resolveOption, filterSizeOptions, appendSelection } from '../src/model-channels.js'
import { sizeOptions } from '../src/image-sizes.js'

const channels = [
  {
    id: 'c1',
    name: '站A',
    groups: [
      { id: 'g1', name: '便宜1K分组', models: [{ id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024', '1536x1024'] }] },
      { id: 'g2', name: '高级分组', models: [{ id: 'm2', name: 'gpt-image-2-pro', sizes: ['3840x2160'] }] }
    ]
  }
]

test('flattenChannels builds selectable options with labels', () => {
  const options = flattenChannels(channels)
  assert.equal(options.length, 2)
  assert.equal(options[0].key, 'c1::g1::m1')
  assert.equal(options[0].label, '站A · 便宜1K分组 · gpt-image-2')
  assert.deepEqual(options[0].sizes, ['1024x1024', '1536x1024'])
})

test('flattenChannels tolerates missing data', () => {
  assert.deepEqual(flattenChannels(undefined), [])
  assert.deepEqual(flattenChannels([{ id: 'c', name: 'n' }]), [])
  assert.deepEqual(flattenChannels([{ id: 'c', name: 'n', groups: [{ id: 'g', name: 'g' }] }]), [])
})

test('parseSelectionKey splits ids and rejects short keys', () => {
  assert.deepEqual(parseSelectionKey('c1::g1::m1'), { channelId: 'c1', groupId: 'g1', modelId: 'm1' })
  assert.deepEqual(parseSelectionKey(''), { channelId: undefined, groupId: undefined, modelId: undefined })
  assert.deepEqual(parseSelectionKey('c1::g1'), { channelId: undefined, groupId: undefined, modelId: undefined })
})

test('selectionPayload returns snake_case request fields', () => {
  assert.deepEqual(selectionPayload('c1::g1::m1'), { channel_id: 'c1', group_id: 'g1', model_id: 'm1' })
  assert.deepEqual(selectionPayload(''), { channel_id: undefined, group_id: undefined, model_id: undefined })
})

test('resolveOption falls back to the first option', () => {
  const options = flattenChannels(channels)
  assert.equal(resolveOption(options, 'c1::g2::m2').modelName, 'gpt-image-2-pro')
  assert.equal(resolveOption(options, 'bogus').modelName, 'gpt-image-2')
  assert.equal(resolveOption([], 'x'), null)
})

test('filterSizeOptions keeps supported sizes in catalog order', () => {
  const filtered = filterSizeOptions(sizeOptions, ['1024x1024', '3840x2160'])
  assert.deepEqual(filtered.map((option) => option.value), ['3840x2160', '1024x1024'])
  assert.equal(filterSizeOptions(sizeOptions, []).length, sizeOptions.length)
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

test('generation pages include the model picker and filtered sizes', async () => {
  const fs = await import('node:fs/promises')
  for (const name of ['Generate.vue', 'EditImage.vue', 'ReferenceGenerate.vue', 'BatchEdit.vue']) {
    const source = await fs.readFile(new URL(`../src/views/${name}`, import.meta.url), 'utf8')
    assert.match(source, /useModelChannels/, `${name} should use model channels`)
    assert.match(source, /availableSizeOptions/, `${name} should filter sizes by model`)
    assert.match(source, /selectionPayload|appendSelection/, `${name} should send the selection`)
  }
})

test('settings page edits image channels', async () => {
  const fs = await import('node:fs/promises')
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /image_channels/)
  assert.match(source, /addChannel/)
  assert.match(source, /addGroup/)
  assert.match(source, /addModel/)
})
