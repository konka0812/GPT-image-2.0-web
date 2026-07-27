import fs from 'fs/promises'
import path from 'path'

export const sizes = ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2160x3840', '3840x2160']
export const qualities = ['low', 'medium', 'high']
export const formats = ['png', 'jpeg', 'webp']

export function assertEnum(value, list, fallback) {
  return list.includes(value) ? value : fallback
}

export async function saveBase64Image(b64, format = 'png') {
  const safeFormat = assertEnum(format, formats, 'png')
  const dir = process.env.UPLOAD_DIR || 'uploads'
  await fs.mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeFormat}`
  const file = path.join(dir, name)
  await fs.writeFile(file, Buffer.from(b64, 'base64'))
  return `/uploads/${name}`
}

export async function saveImage(item, format = 'png') {
  if (item.b64_json) {
    return saveBase64Image(item.b64_json, format)
  }
  if (item.url) {
    const safeFormat = assertEnum(format, formats, 'png')
    const dir = process.env.UPLOAD_DIR || 'uploads'
    await fs.mkdir(dir, { recursive: true })
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeFormat}`
    const file = path.join(dir, name)
    const response = await fetch(item.url)
    if (!response.ok) throw new Error(`下载图片失败: HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(file, buffer)
    return `/uploads/${name}`
  }
  throw new Error('上游返回的图片数据格式未知')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(error) {
  const message = error?.message || ''
  if (message.includes('上游任务')) return false
  return message.includes('超时') || message.includes('暂时不可用') || message.includes('timeout') || message.includes('HTTP 502') || message.includes('HTTP 524')
}

export function resolvePollUrl(baseUrl, pollUrl) {
  return new URL(pollUrl, `${new URL(baseUrl).origin}/`).toString()
}

export function isCompletedImageTask(data) {
  return Array.isArray(data?.data) && data.data.some((item) => item?.b64_json || item?.url)
}

async function pollAsyncTask({ baseUrl, apiKey, pollUrl, pollAfterMs = 8000, onStatus = () => {} }) {
  const url = resolvePollUrl(baseUrl, pollUrl)
  const maxWaitMs = 300000
  const intervalMs = Math.max(8000, Math.min(pollAfterMs || 8000, 10000))
  const start = Date.now()
  let pollCount = 0
  while (Date.now() - start < maxWaitMs) {
    await sleep(intervalMs)
    pollCount += 1
    onStatus({ type: 'poll', pollCount, status: 'running', baseUrl })
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60000)
    })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { error: text } }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `HTTP ${response.status}`
      throw new Error(typeof message === 'string' ? message.slice(0, 300) : JSON.stringify(message))
    }
    const status = data?.status
    onStatus({ type: 'poll-result', pollCount, status: status || 'processing', baseUrl })
    if (isCompletedImageTask(data) || status === 'succeeded' || status === 'completed' || status === 'success') return data
    if (status === 'failed' || status === 'error' || status === 'rejected') {
      throw new Error(data?.message || data?.error?.message || '上游任务失败')
    }
  }
  throw new Error('上游任务处理超时，请降低质量/尺寸后重试')
}

export async function callImageApi({ baseUrl, apiKey, endpoint, payload, onStatus = () => {} }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300000)
  })
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = { error: text } }
  if (response.status === 202 && data?.poll_url) {
    onStatus({ type: 'accepted', status: data.status || 'queued', baseUrl })
    return pollAsyncTask({ baseUrl, apiKey, pollUrl: data.poll_url, pollAfterMs: data.poll_after_ms, onStatus })
  }
  if (!response.ok) {
    if (response.status === 524 || text.includes('Error code 524') || text.includes('A timeout occurred')) {
      throw new Error('上游接口处理超时，请降低质量/尺寸后重试，或稍后再试')
    }
    if (response.status === 502) throw new Error('上游接口暂时不可用，请稍后重试')
    const message = data?.error?.message || data?.error || `HTTP ${response.status}`
    const clean = typeof message === 'string' ? message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(message)
    throw new Error(clean.slice(0, 300))
  }
  return data
}

export async function callImageApiWithRetry(args, retries = 2, onStatus = () => {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      onStatus({ type: 'attempt', attempt: attempt + 1, max: retries + 1, baseUrl: args.baseUrl })
      return await callImageApi({ ...args, onStatus })
    } catch (error) {
      lastError = error
      if (attempt === retries || !isRetryable(error)) throw error
      onStatus({ type: 'retry', attempt: attempt + 1, nextAttempt: attempt + 2, max: retries + 1, baseUrl: args.baseUrl, error: error.message })
      await sleep(8000 * (attempt + 1))
    }
  }
  throw lastError
}
