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

export function filterSizeOptions(sizeOptions = [], allowed = []) {
  const allowedSet = new Set(Array.isArray(allowed) ? allowed : [])
  if (!allowedSet.size) return sizeOptions
  return sizeOptions.filter((option) => allowedSet.has(option.value))
}
