import { sizes as knownSizes } from './utils.js'

export const defaultModel = 'gpt-image-2'

export function normalizeModel(value) {
  return String(value || '').trim() || defaultModel
}

export function requireModel(value) {
  const model = String(value || '').trim()
  if (!model) throw new Error('请填写模型名称')
  return model
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function text(value) {
  return String(value ?? '').trim()
}

export function normalizeChannels(value) {
  if (!Array.isArray(value)) return []
  const channels = []
  for (const channel of value) {
    const baseUrl = text(channel?.base_url)
    if (!baseUrl) continue
    const groups = []
    for (const group of Array.isArray(channel?.groups) ? channel.groups : []) {
      const apiKey = text(group?.api_key)
      if (!apiKey) continue
      const models = []
      for (const model of Array.isArray(group?.models) ? group.models : []) {
        const name = text(model?.name)
        if (!name) continue
        const allowed = [...new Set((Array.isArray(model?.sizes) ? model.sizes : []).filter((size) => knownSizes.includes(size)))]
        if (!allowed.length) continue
        models.push({ id: text(model?.id) || makeId('md'), name, sizes: allowed })
      }
      if (!models.length) continue
      groups.push({ id: text(group?.id) || makeId('gr'), name: text(group?.name) || '未命名分组', api_key: apiKey, models })
    }
    if (!groups.length) continue
    channels.push({ id: text(channel?.id) || makeId('ch'), name: text(channel?.name) || '未命名站点', base_url: baseUrl, groups })
  }
  return channels
}

export function findImageTarget(channels, ref = {}) {
  if (!Array.isArray(channels) || !channels.length) return null
  const channel = channels.find((item) => item.id === ref.channel_id) || channels[0]
  const group = channel.groups.find((item) => item.id === ref.group_id) || channel.groups[0]
  const model = group.models.find((item) => item.id === ref.model_id) || group.models[0]
  return {
    channelId: channel.id,
    groupId: group.id,
    modelId: model.id,
    baseUrl: channel.base_url,
    apiKey: group.api_key,
    model: model.name,
    sizes: model.sizes
  }
}

export function publicChannels(channels) {
  return (Array.isArray(channels) ? channels : []).map((channel) => ({
    id: channel.id,
    name: channel.name,
    groups: channel.groups.map((group) => ({
      id: group.id,
      name: group.name,
      models: group.models.map((model) => ({ id: model.id, name: model.name, sizes: model.sizes }))
    }))
  }))
}

export function legacyChannels(row, fallbackBaseUrl) {
  const apiKey = text(row?.api_key)
  if (!apiKey) return []
  return [{
    id: makeId('ch'),
    name: '默认站点',
    base_url: text(row?.base_url) || fallbackBaseUrl,
    groups: [{
      id: makeId('gr'),
      name: '默认分组',
      api_key: apiKey,
      models: [{
        id: makeId('md'),
        name: normalizeModel(row?.model),
        sizes: [...knownSizes]
      }]
    }]
  }]
}
