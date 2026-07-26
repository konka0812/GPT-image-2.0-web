export const maxReferenceImages = 16

export function appendReferenceFiles(current, incoming) {
  return [...current, ...incoming].slice(0, maxReferenceImages)
}

export function moveReferenceFile(items, from, to) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function removeReferenceFile(items, index) {
  return items.filter((_, itemIndex) => itemIndex !== index)
}
