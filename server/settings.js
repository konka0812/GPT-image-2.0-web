export const defaultModel = 'gpt-image-2'

export function normalizeModel(value) {
  return String(value || '').trim() || defaultModel
}

export function requireModel(value) {
  const model = String(value || '').trim()
  if (!model) throw new Error('请填写模型名称')
  return model
}
