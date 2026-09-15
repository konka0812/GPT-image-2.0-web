import fs from 'node:fs'
import path from 'node:path'

const recentGuardMs = 10 * 60 * 1000

export function collectImageNames(records = []) {
  const names = new Set()
  for (const record of Array.isArray(records) ? records : []) {
    let items = []
    try { items = JSON.parse(record?.image_path || '[]') } catch { continue }
    for (const item of Array.isArray(items) ? items : []) {
      const name = String(item).split('/').pop()
      if (name) names.add(name)
    }
  }
  return names
}

export function imageStats(uploadDir, referenced = new Set()) {
  const stats = { totalFiles: 0, totalBytes: 0, orphanFiles: 0, orphanBytes: 0, referencedFiles: 0, referencedBytes: 0 }
  let entries = []
  try { entries = fs.readdirSync(uploadDir) } catch { return stats }
  for (const name of entries) {
    let stat
    try { stat = fs.statSync(path.join(uploadDir, name)) } catch { continue }
    if (!stat.isFile()) continue
    stats.totalFiles += 1
    stats.totalBytes += stat.size
    if (referenced.has(name)) {
      stats.referencedFiles += 1
      stats.referencedBytes += stat.size
    } else {
      stats.orphanFiles += 1
      stats.orphanBytes += stat.size
    }
  }
  return stats
}

export function removeImages(uploadDir, names = []) {
  let deleted = 0
  let freedBytes = 0
  for (const name of names) {
    const full = path.join(uploadDir, name)
    try {
      const stat = fs.statSync(full)
      if (!stat.isFile()) continue
      fs.rmSync(full, { force: true })
      deleted += 1
      freedBytes += stat.size
    } catch {}
  }
  return { deleted, freedBytes }
}

export function cleanupOrphans(uploadDir, referenced = new Set(), now = Date.now()) {
  let entries = []
  try { entries = fs.readdirSync(uploadDir) } catch { return { deleted: 0, freedBytes: 0 } }
  const names = []
  for (const name of entries) {
    let stat
    try { stat = fs.statSync(path.join(uploadDir, name)) } catch { continue }
    if (!stat.isFile()) continue
    if (referenced.has(name)) continue
    if (now - stat.mtimeMs < recentGuardMs) continue
    names.push(name)
  }
  return removeImages(uploadDir, names)
}
