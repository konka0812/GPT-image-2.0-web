import fs from 'fs/promises'
import path from 'path'

export const sizes = ['1024x1024', '1536x1024', '1024x1536', '1360x1024', '1024x1360', '1536x864', '864x1536', '2048x2048', '2048x1360', '1360x2048', '2048x1536', '1536x2048', '2048x1152', '1152x2048', '2880x2880', '3520x2336', '2336x3520', '3312x2480', '2480x3312', '3840x2160', '2160x3840']
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

const upstreamStatusLabels = {
  queued: '排队中',
  dispatching: '调度中',
  running: '处理中',
  processing: '处理中',
  success: '已完成',
  succeeded: '已完成',
  completed: '已完成',
  failed: '已失败',
  error: '出错',
  rejected: '被拒绝',
  uncertain: '状态不确定，继续查询',
  client_disconnected: '客户端断开，继续查询',
  paused: '已暂停，等待恢复',
  canceled: '已取消',
  cancelled: '已取消'
}

const terminalFailureStatuses = new Set(['failed', 'error', 'rejected', 'canceled', 'cancelled'])

const defaultPollBudgetMs = Number(process.env.POLL_BUDGET_MS || 900000)
const uncertainPollBudgetMs = Number(process.env.POLL_UNCERTAIN_BUDGET_MS || 1200000)
const pausedPollGraceMs = Number(process.env.POLL_PAUSED_GRACE_MS || 120000)

export function pollBudgetMs({ baseMs, uncertainMs, sawUncertain }) {
  return sawUncertain ? uncertainMs : baseMs
}

export function evaluatePollState({ elapsedMs, budgetMs, pausedMs, pausedGraceMs }) {
  if (pausedMs >= pausedGraceMs) return { stop: true, reason: 'paused' }
  if (elapsedMs >= budgetMs) return { stop: true, reason: 'timeout' }
  return { stop: false, reason: '' }
}

export function formatWaitMs(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  if (total < 60) return `${total}秒`
  return `${Math.floor(total / 60)}分${String(total % 60).padStart(2, '0')}秒`
}

export function upstreamStatusLabel(status) {
  return upstreamStatusLabels[status] || status || ''
}

export function extractImageItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const candidates = []
  if (Array.isArray(payload.data)) candidates.push(...payload.data)
  if (Array.isArray(payload.assets)) candidates.push(...payload.assets)
  if (Array.isArray(payload.summary?.assets)) candidates.push(...payload.summary.assets)
  return candidates.filter((item) => item && (item.b64_json || item.signed_url || item.url || item.download_url))
}

export function resolveImageSource(item) {
  if (!item || typeof item !== 'object') return null
  if (item.b64_json) return { type: 'base64', data: item.b64_json }
  if (item.signed_url) return { type: 'url', url: item.signed_url, signed: true }
  const url = item.url || item.download_url
  if (url) return { type: 'url', url, signed: false }
  return null
}

export function sameSite(url, baseUrl) {
  try {
    const site = (value) => new URL(value).hostname.split('.').slice(-2).join('.')
    return site(url) === site(baseUrl)
  } catch {
    return false
  }
}

export function resolveAssetUrl(url, baseUrl) {
  if (!url) return ''
  try {
    return baseUrl ? resolvePollUrl(baseUrl, url) : url
  } catch {
    return url
  }
}

async function downloadImage(url, { apiKey, baseUrl, signed }) {
  const target = resolveAssetUrl(url, baseUrl)
  const attempts = []
  if (!signed && apiKey && sameSite(target, baseUrl)) attempts.push({ Authorization: `Bearer ${apiKey}` })
  attempts.push(null)
  let lastError
  for (const headers of attempts) {
    const response = await fetch(target, headers ? { headers } : {})
    if (response.ok) return Buffer.from(await response.arrayBuffer())
    lastError = new Error(`下载图片失败: HTTP ${response.status}`)
    if (response.status !== 401 && response.status !== 403) throw lastError
  }
  throw lastError
}

export async function saveImage(item, format = 'png', options = {}) {
  const source = resolveImageSource(item)
  if (!source) throw new Error('上游返回的图片数据格式未知')
  if (source.type === 'base64') return saveBase64Image(source.data, format)
  const safeFormat = assertEnum(format, formats, 'png')
  const dir = process.env.UPLOAD_DIR || 'uploads'
  await fs.mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeFormat}`
  const file = path.join(dir, name)
  const buffer = await downloadImage(source.url, { apiKey: options.apiKey, baseUrl: options.baseUrl, signed: source.signed })
  await fs.writeFile(file, buffer)
  return `/uploads/${name}`
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

export function isCompletedImageTask(payload) {
  return extractImageItems(payload).length > 0
}

async function pollAsyncTask({ baseUrl, apiKey, pollUrl, pollAfterMs = 3000, onStatus = () => {} }) {
  const url = resolvePollUrl(baseUrl, pollUrl)
  const startedAt = Date.now()
  let intervalMs = Math.max(1000, Math.min(pollAfterMs || 3000, 10000))
  let pollCount = 0
  let pausedSince = 0
  let sawUncertain = false

  while (true) {
    const elapsedMs = Date.now() - startedAt
    const budget = pollBudgetMs({ baseMs: defaultPollBudgetMs, uncertainMs: uncertainPollBudgetMs, sawUncertain })
    const decision = evaluatePollState({ elapsedMs, budgetMs: budget, pausedMs: pausedSince ? Date.now() - pausedSince : 0, pausedGraceMs: pausedPollGraceMs })
    if (decision.stop) {
      if (decision.reason === 'paused') throw new Error(`上游任务已暂停超过 ${formatWaitMs(pausedPollGraceMs)}，请稍后重试`)
      throw new Error(sawUncertain
        ? `上游任务状态不确定，已等待 ${formatWaitMs(elapsedMs)} 仍未确认结果，请稍后在服务商后台核对`
        : `上游任务处理超时（已等待 ${formatWaitMs(elapsedMs)}），请降低尺寸或质量后重试`)
    }

    await sleep(intervalMs)
    pollCount += 1
    onStatus({ type: 'poll', pollCount, status: 'running', baseUrl, elapsedMs, budgetMs: budget })
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
    if (data?.poll_after_ms) intervalMs = Math.max(1000, Math.min(data.poll_after_ms, 10000))
    const status = data?.status
    if (status === 'paused') pausedSince = pausedSince || Date.now()
    else pausedSince = 0
    if (status === 'uncertain' || status === 'client_disconnected') sawUncertain = true
    onStatus({
      type: 'poll-result',
      pollCount,
      status: status || 'processing',
      baseUrl,
      elapsedMs: Date.now() - startedAt,
      budgetMs: pollBudgetMs({ baseMs: defaultPollBudgetMs, uncertainMs: uncertainPollBudgetMs, sawUncertain })
    })
    if (isCompletedImageTask(data) || status === 'succeeded' || status === 'completed' || status === 'success') return data
    if (terminalFailureStatuses.has(status)) {
      throw new Error(data?.error?.message || data?.message || `上游任务${upstreamStatusLabel(status)}`)
    }
  }
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
