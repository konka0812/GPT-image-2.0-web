import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePollUrl, extractImageItems, isCompletedImageTask, resolveImageSource, resolveImageSources, resolveAssetUrl, sameSite, upstreamStatusLabel, pollBudgetMs, evaluatePollState, formatWaitMs, isTransientNetworkError, extractTaskId, isExpiredAt } from '../server/utils.js'

test('resolvePollUrl resolves root-relative task URLs against the origin', () => {
  assert.equal(
    resolvePollUrl('https://api.example.com/v1', '/v1/images/tasks/task-1'),
    'https://api.example.com/v1/images/tasks/task-1'
  )
})

test('resolvePollUrl preserves absolute task URLs', () => {
  assert.equal(
    resolvePollUrl('https://api.example.com/v1', 'https://tasks.example.com/task-1'),
    'https://tasks.example.com/task-1'
  )
})

test('extractImageItems reads OpenAI style data arrays', () => {
  assert.equal(extractImageItems({ data: [{ url: 'https://cdn/1.png' }] }).length, 1)
  assert.equal(extractImageItems({ data: [{ b64_json: 'abc' }] }).length, 1)
})

test('extractImageItems reads platform assets and summary assets', () => {
  assert.equal(extractImageItems({ assets: [{ signed_url: 'https://cdn/2.png' }] }).length, 1)
  assert.equal(extractImageItems({ summary: { assets: [{ download_url: 'https://cdn/3.png' }] } }).length, 1)
  assert.equal(extractImageItems({ assets: [{}, { size: 1 }] }).length, 0)
  assert.equal(extractImageItems({}).length, 0)
  assert.equal(extractImageItems(null).length, 0)
})

test('isCompletedImageTask accepts signed assets and rejects pending tasks', () => {
  assert.equal(isCompletedImageTask({ status: 'success', assets: [{ signed_url: 'https://cdn/a.png' }] }), true)
  assert.equal(isCompletedImageTask({ status: 'running', assets: [] }), false)
  assert.equal(isCompletedImageTask({ status: 'queued' }), false)
})

test('resolveImageSource prefers base64, then signed urls, then plain urls', () => {
  assert.deepEqual(resolveImageSource({ b64_json: 'abc' }), { type: 'base64', data: 'abc' })
  assert.deepEqual(resolveImageSource({ signed_url: 'https://s', url: 'https://u' }), { type: 'url', url: 'https://s', signed: true })
  assert.deepEqual(resolveImageSource({ url: 'https://u' }), { type: 'url', url: 'https://u', signed: false })
  assert.deepEqual(resolveImageSource({ download_url: 'https://d' }), { type: 'url', url: 'https://d', signed: false })
  assert.equal(resolveImageSource({}), null)
})

test('resolveImageSources lists every download candidate in priority order', () => {
  assert.deepEqual(resolveImageSources({ b64_json: 'a', signed_url: 'https://s', url: 'https://u', download_url: 'https://d' }), [
    { type: 'base64', data: 'a' },
    { type: 'url', url: 'https://s', signed: true, expiresAt: undefined },
    { type: 'url', url: 'https://u', signed: false, expiresAt: undefined },
    { type: 'url', url: 'https://d', signed: false, expiresAt: undefined }
  ])
  assert.deepEqual(resolveImageSources({ url: 'https://u' }), [{ type: 'url', url: 'https://u', signed: false, expiresAt: undefined }])
  assert.deepEqual(resolveImageSources({}), [])
  assert.deepEqual(resolveImageSources(null), [])
})

test('resolveImageSources carries upstream expiry timestamps', () => {
  const sources = resolveImageSources({ signed_url: 'https://s', signed_url_expires_at: '2026-10-15T00:00:00Z', url: 'https://u', expires_at: '2026-10-16T00:00:00Z' })
  assert.equal(sources[0].expiresAt, '2026-10-15T00:00:00Z')
  assert.equal(sources[1].expiresAt, '2026-10-16T00:00:00Z')
})

test('isExpiredAt detects past and future timestamps', () => {
  const now = new Date('2026-10-14T12:00:00Z').getTime()
  assert.equal(isExpiredAt('2026-10-14T11:00:00Z', now), true)
  assert.equal(isExpiredAt('2026-10-14T13:00:00Z', now), false)
  assert.equal(isExpiredAt('', now), false)
  assert.equal(isExpiredAt(undefined, now), false)
  assert.equal(isExpiredAt('not-a-date', now), false)
})

test('sameSite keeps api keys from leaking to other domains', () => {
  assert.equal(sameSite('https://media.example.com/a.png', 'https://api.example.com/v1'), true)
  assert.equal(sameSite('https://api.example.com/a.png', 'https://api.example.com/v1'), true)
  assert.equal(sameSite('https://evil.example.com/a.png', 'https://api.example.com/v1'), false)
  assert.equal(sameSite('not-a-url', 'https://api.example.com/v1'), false)
})

test('resolveAssetUrl turns platform asset paths into absolute urls', () => {
  assert.equal(
    resolveAssetUrl('/v1/images/tasks/imgtask-1/assets/a.png', 'https://api.example.com/v1'),
    'https://api.example.com/v1/images/tasks/imgtask-1/assets/a.png'
  )
  assert.equal(
    resolveAssetUrl('https://media.example.com/v1/x/a.png', 'https://api.example.com/v1'),
    'https://media.example.com/v1/x/a.png'
  )
  assert.equal(resolveAssetUrl('', 'https://api.example.com/v1'), '')
})

test('upstreamStatusLabel translates platform statuses', () => {
  assert.equal(upstreamStatusLabel('queued'), '排队中')
  assert.equal(upstreamStatusLabel('dispatching'), '调度中')
  assert.equal(upstreamStatusLabel('running'), '处理中')
  assert.equal(upstreamStatusLabel('success'), '已完成')
  assert.equal(upstreamStatusLabel('uncertain'), '状态不确定，继续查询')
  assert.equal(upstreamStatusLabel('client_disconnected'), '客户端断开，继续查询')
  assert.equal(upstreamStatusLabel('canceled'), '已取消')
  assert.equal(upstreamStatusLabel('paused'), '已暂停，等待恢复')
  assert.equal(upstreamStatusLabel('mystery'), 'mystery')
})

test('pollBudgetMs widens the deadline after uncertain statuses', () => {
  assert.equal(pollBudgetMs({ baseMs: 900000, uncertainMs: 1200000, sawUncertain: false }), 900000)
  assert.equal(pollBudgetMs({ baseMs: 900000, uncertainMs: 1200000, sawUncertain: true }), 1200000)
})

test('evaluatePollState stops on timeout and paused grace', () => {
  assert.deepEqual(evaluatePollState({ elapsedMs: 100, budgetMs: 1000, pausedMs: 0, pausedGraceMs: 100 }), { stop: false, reason: '' })
  assert.deepEqual(evaluatePollState({ elapsedMs: 1000, budgetMs: 1000, pausedMs: 0, pausedGraceMs: 100 }), { stop: true, reason: 'timeout' })
  assert.deepEqual(evaluatePollState({ elapsedMs: 10, budgetMs: 1000, pausedMs: 150, pausedGraceMs: 100 }), { stop: true, reason: 'paused' })
  assert.deepEqual(evaluatePollState({ elapsedMs: 10, budgetMs: 1000, pausedMs: 50, pausedGraceMs: 100 }), { stop: false, reason: '' })
})

test('formatWaitMs renders short human readable waits', () => {
  assert.equal(formatWaitMs(45000), '45秒')
  assert.equal(formatWaitMs(150000), '2分30秒')
  assert.equal(formatWaitMs(900000), '15分00秒')
})

test('isTransientNetworkError detects dropped connections', () => {
  assert.equal(isTransientNetworkError(new Error('fetch failed')), true)
  assert.equal(isTransientNetworkError(new Error('terminated')), true)
  assert.equal(isTransientNetworkError(new Error('socket hang up')), true)
  assert.equal(isTransientNetworkError({ message: 'fetch failed', cause: { code: 'ECONNRESET' } }), true)
  assert.equal(isTransientNetworkError({ message: 'other side closed', cause: { code: 'UND_ERR_SOCKET' } }), true)
  assert.equal(isTransientNetworkError(new Error('HTTP 401')), false)
  assert.equal(isTransientNetworkError(new Error('上游任务失败')), false)
  assert.equal(isTransientNetworkError(null), false)
})

test('extractTaskId pulls the upstream task id from poll urls', () => {
  assert.equal(extractTaskId('/v1/images/tasks/imgtask_706fd70c-2e49-48b4-99f4-d1941f5e5b6c'), 'imgtask_706fd70c-2e49-48b4-99f4-d1941f5e5b6c')
  assert.equal(extractTaskId('https://api.example.com/v1/images/tasks/imgtask_abc-123?view=summary'), 'imgtask_abc-123')
  assert.equal(extractTaskId(''), '')
  assert.equal(extractTaskId(undefined), '')
})
