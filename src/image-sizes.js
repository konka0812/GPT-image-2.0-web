export const tierOrder = ['1K', '2K', '4K']

export const ratioOrder = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16']

export const sizeCatalog = [
  { value: '1024x1024', tier: '1K', ratio: '1:1', name: '方图' },
  { value: '1536x1024', tier: '1K', ratio: '3:2', name: '横版' },
  { value: '1024x1536', tier: '1K', ratio: '2:3', name: '竖版' },
  { value: '1360x1024', tier: '1K', ratio: '4:3', name: '横版' },
  { value: '1024x1360', tier: '1K', ratio: '3:4', name: '竖版' },
  { value: '1536x864', tier: '1K', ratio: '16:9', name: '横版' },
  { value: '864x1536', tier: '1K', ratio: '9:16', name: '竖版' },
  { value: '2048x2048', tier: '2K', ratio: '1:1', name: '方图' },
  { value: '2048x1360', tier: '2K', ratio: '3:2', name: '横版' },
  { value: '1360x2048', tier: '2K', ratio: '2:3', name: '竖版' },
  { value: '2048x1536', tier: '2K', ratio: '4:3', name: '横版' },
  { value: '1536x2048', tier: '2K', ratio: '3:4', name: '竖版' },
  { value: '2048x1152', tier: '2K', ratio: '16:9', name: '横版' },
  { value: '1152x2048', tier: '2K', ratio: '9:16', name: '竖版' },
  { value: '2880x2880', tier: '4K', ratio: '1:1', name: '方图' },
  { value: '3520x2336', tier: '4K', ratio: '3:2', name: '横版' },
  { value: '2336x3520', tier: '4K', ratio: '2:3', name: '竖版' },
  { value: '3312x2480', tier: '4K', ratio: '4:3', name: '横版' },
  { value: '2480x3312', tier: '4K', ratio: '3:4', name: '竖版' },
  { value: '3840x2160', tier: '4K', ratio: '16:9', name: '横版' },
  { value: '2160x3840', tier: '4K', ratio: '9:16', name: '竖版' }
]

export function formatPixels(value) {
  return String(value || '').replace('x', '×')
}

export function sizeLabel(entry) {
  return entry ? `${entry.ratio} ${entry.name} · ${formatPixels(entry.value)}` : ''
}

export function sizeFullLabel(entry) {
  return entry ? `${entry.tier} ${sizeLabel(entry)}` : ''
}

export function findSizeEntry(value) {
  return sizeCatalog.find((entry) => entry.value === value) || null
}
