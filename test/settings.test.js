import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { normalizeModel, requireModel, normalizeChannels, findImageTarget, publicChannels, legacyChannels } from '../server/settings.js'

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

test('normalizeChannels keeps valid entries and drops incomplete ones', () => {
  const channels = normalizeChannels([
    {
      id: 'c1',
      name: '站A',
      base_url: 'https://a.example/v1',
      groups: [
        {
          id: 'g1',
          name: '便宜分组',
          api_key: 'sk-1',
          models: [
            { id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024', '1024x1024', 'bogus-size'] },
            { id: 'm2', name: '   ', sizes: ['1024x1024'] }
          ]
        },
        { id: 'g2', name: '缺Key', api_key: '', models: [{ id: 'm3', name: 'x', sizes: ['1024x1024'] }] },
        { id: 'g3', name: '缺尺寸', api_key: 'sk-3', models: [{ id: 'm4', name: 'y', sizes: [] }] }
      ]
    },
    { id: 'c2', name: '缺URL', base_url: '   ', groups: [{ id: 'g4', name: 'g', api_key: 'sk-4', models: [{ id: 'm5', name: 'z', sizes: ['1024x1024'] }] }] }
  ])
  assert.equal(channels.length, 1)
  assert.equal(channels[0].groups.length, 1)
  assert.equal(channels[0].groups[0].models.length, 1)
  assert.deepEqual(channels[0].groups[0].models[0].sizes, ['1024x1024'])
  assert.equal(channels[0].name, '站A')
})

test('normalizeChannels generates ids for entries missing them', () => {
  const channels = normalizeChannels([
    { name: '站A', base_url: 'https://a.example/v1', groups: [{ name: 'g', api_key: 'sk-1', models: [{ name: 'gpt-image-2', sizes: ['1024x1024'] }] }] }
  ])
  assert.ok(channels[0].id)
  assert.ok(channels[0].groups[0].id)
  assert.ok(channels[0].groups[0].models[0].id)
})

test('findImageTarget resolves by id and falls back to the first entry', () => {
  const channels = normalizeChannels([
    {
      id: 'c1',
      name: '站A',
      base_url: 'https://a.example/v1',
      groups: [
        { id: 'g1', name: '便宜', api_key: 'sk-1', models: [{ id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024'] }] },
        { id: 'g2', name: '高级', api_key: 'sk-2', models: [{ id: 'm2', name: 'gpt-image-2-pro', sizes: ['3840x2160'] }] }
      ]
    }
  ])
  const chosen = findImageTarget(channels, { channel_id: 'c1', group_id: 'g2', model_id: 'm2' })
  assert.equal(chosen.apiKey, 'sk-2')
  assert.equal(chosen.model, 'gpt-image-2-pro')
  assert.deepEqual(chosen.sizes, ['3840x2160'])

  const fallback = findImageTarget(channels, {})
  assert.equal(fallback.modelId, 'm1')
  assert.equal(fallback.apiKey, 'sk-1')

  const oversized = findImageTarget(channels, { group_id: 'g2' })
  assert.equal(oversized.groupId, 'g2')
  assert.equal(oversized.modelId, 'm2')

  assert.equal(findImageTarget([], {}), null)
})

test('publicChannels never exposes api keys', () => {
  const channels = normalizeChannels([
    { id: 'c1', name: '站A', base_url: 'https://a.example/v1', groups: [{ id: 'g1', name: 'g', api_key: 'sk-secret', models: [{ id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024'] }] }] }
  ])
  const tree = publicChannels(channels)
  assert.doesNotMatch(JSON.stringify(tree), /sk-secret/)
  assert.equal(tree[0].groups[0].models[0].sizes[0], '1024x1024')
})

test('legacyChannels migrates old single-model settings', () => {
  const channels = legacyChannels({ base_url: 'https://old.example/v1', api_key: 'sk-old', model: 'gpt-image-2' }, 'https://fallback.example/v1')
  assert.equal(channels.length, 1)
  assert.equal(channels[0].base_url, 'https://old.example/v1')
  assert.equal(channels[0].groups[0].api_key, 'sk-old')
  assert.equal(channels[0].groups[0].models[0].name, 'gpt-image-2')
  assert.ok(channels[0].groups[0].models[0].sizes.length >= 6)
  assert.deepEqual(legacyChannels({}, 'https://fallback.example/v1'), [])
})

test('findImageTarget exposes display names for history records', () => {
  const channels = normalizeChannels([
    { id: 'c1', name: '站A', base_url: 'https://a.example/v1', groups: [{ id: 'g1', name: '便宜分组', api_key: 'sk-1', models: [{ id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024'] }] }] }
  ])
  const target = findImageTarget(channels, {})
  assert.equal(target.channelName, '站A')
  assert.equal(target.groupName, '便宜分组')
  assert.equal(target.modelName, 'gpt-image-2')
})

test('settings page has no legacy fallback provider references', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /hk\.testvideo\.site|失败自动切换/)
})

test('settings page scrolls, is wider and confirms saves with a dialog', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /max-w-6xl/)
  assert.match(source, /overflow-y-auto/)
  assert.match(source, /保存成功/)
  assert.match(source, /showDialog/)
})

test('settings page exposes orphan image cleanup', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /清理无用图片/)
  assert.match(source, /api\/maintenance\/cleanup-images/)
  assert.match(source, /api\/maintenance\/image-stats/)
})

test('settings page requires edit mode before changes', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /编辑配置/)
  assert.match(source, /startEdit/)
  assert.match(source, /cancelEdit/)
  assert.match(source, /v-if="!editing"/)
  assert.match(source, /maskKey/)
})
