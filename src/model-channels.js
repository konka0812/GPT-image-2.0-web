import { ratioOrder, tierOrder } from './image-sizes.js'

export function flattenChannels(channels = []) {
  const options = []
  for (const channel of Array.isArray(channels) ? channels : []) {
    for (const group of Array.isArray(channel?.groups) ? channel.groups : []) {
      for (const model of Array.isArray(group?.models) ? group.models : []) {
        options.push({
          key: `${channel.id}::${group.id}::${model.id}`,
          channelId: channel.id,
          groupId: group.id,
          modelId: model.id,
          channelName: channel.name,
          groupName: group.name,
          modelName: model.name,
          sizes: Array.isArray(model.sizes) ? model.sizes : [],
          label: `${channel.name} · ${group.name} · ${model.name}`
        })
      }
    }
  }
  return options
}

export function parseSelectionKey(key = '') {
  const parts = String(key || '').split('::')
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { channelId: undefined, groupId: undefined, modelId: undefined }
  }
  return { channelId: parts[0], groupId: parts[1], modelId: parts[2] }
}

export function selectionPayload(key) {
  const { channelId, groupId, modelId } = parseSelectionKey(key)
  return { channel_id: channelId, group_id: groupId, model_id: modelId }
}

export function appendSelection(formData, key) {
  for (const [name, value] of Object.entries(selectionPayload(key))) {
    if (value) formData.append(name, value)
  }
}

export function resolveOption(options = [], key) {
  return options.find((option) => option.key === key) || options[0] || null
}

export function availableTiers(catalog = []) {
  const present = new Set(catalog.map((entry) => entry.tier))
  return tierOrder.filter((tier) => present.has(tier))
}

export function ratiosForTier(catalog = [], tier = '') {
  const present = new Set(catalog.filter((entry) => entry.tier === tier).map((entry) => entry.ratio))
  return ratioOrder.filter((ratio) => present.has(ratio))
}

export function sizeFor(catalog = [], tier = '', ratio = '') {
  return catalog.find((entry) => entry.tier === tier && entry.ratio === ratio) || null
}

export function normalizeSelection(catalog = [], currentValue = '', tier = '', ratio = '') {
  if (!catalog.length) return { tier: '', ratio: '', value: '' }
  const exact = catalog.find((entry) => entry.value === currentValue)
  if (exact) return { tier: exact.tier, ratio: exact.ratio, value: exact.value }
  const tiers = availableTiers(catalog)
  const nextTier = tiers.includes(tier) ? tier : tiers[0]
  const ratios = ratiosForTier(catalog, nextTier)
  const nextRatio = ratios.includes(ratio) ? ratio : ratios[0]
  const entry = sizeFor(catalog, nextTier, nextRatio)
  return { tier: nextTier, ratio: nextRatio, value: entry ? entry.value : '' }
}
