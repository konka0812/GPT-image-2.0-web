import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePollUrl, extractImageItems, isCompletedImageTask, resolveImageSource, resolveAssetUrl, sameSite, upstreamStatusLabel, pollBudgetMs, evaluatePollState, formatWaitMs } from '../server/utils.js'

test('resolvePollUrl resolves root-relative task URLs against the origin', () => {
  assert.equal(
    resolvePollUrl('https://api.uselg.top/v1', '/v1/images/tasks/task-1'),
    'https://api.uselg.top/v1/images/tasks/task-1'
  )
})

test('resolvePollUrl preserves absolute task URLs', () => {
  assert.equal(
    resolvePollUrl('https://api.uselg.top/v1', 'https://tasks.example.com/task-1'),
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

test('sameSite keeps api keys from leaking to other domains', () => {
  assert.equal(sameSite('https://media.ai-media.vip/a.png', 'https://api.ai-media.vip/v1'), true)
  assert.equal(sameSite('https://api.ai-media.vip/a.png', 'https://api.ai-media.vip/v1'), true)
  assert.equal(sameSite('https://evil.example.com/a.png', 'https://api.ai-media.vip/v1'), false)
  assert.equal(sameSite('not-a-url', 'https://api.ai-media.vip/v1'), false)
})

test('resolveAssetUrl turns platform asset paths into absolute urls', () => {
  assert.equal(
    resolveAssetUrl('/v1/images/tasks/imgtask-1/assets/a.png', 'https://api.ai-media.vip/v1'),
    'https://api.ai-media.vip/v1/images/tasks/imgtask-1/assets/a.png'
  )
  assert.equal(
    resolveAssetUrl('https://media.ai-media.vip/v1/x/a.png', 'https://api.ai-media.vip/v1'),
    'https://media.ai-media.vip/v1/x/a.png'
  )
  assert.equal(resolveAssetUrl('', 'https://api.ai-media.vip/v1'), '')
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
