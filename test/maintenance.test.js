import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { collectImageNames, cleanupOrphans, imageStats, removeImages, findMatchingTask } from '../server/maintenance.js'

function makeDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-test-'))
  fs.writeFileSync(path.join(dir, 'keep.png'), Buffer.alloc(100))
  fs.writeFileSync(path.join(dir, 'orphan.png'), Buffer.alloc(200))
  const old = (Date.now() - 60 * 60 * 1000) / 1000
  fs.utimesSync(path.join(dir, 'keep.png'), old, old)
  fs.utimesSync(path.join(dir, 'orphan.png'), old, old)
  return dir
}

test('collectImageNames reads image paths from records', () => {
  const names = collectImageNames([
    { image_path: '["/uploads/a.png","/uploads/b.png"]' },
    { image_path: '' },
    { image_path: 'not-json' }
  ])
  assert.deepEqual([...names].sort(), ['a.png', 'b.png'])
})

test('cleanupOrphans removes unreferenced files and keeps referenced ones', () => {
  const dir = makeDir()
  const result = cleanupOrphans(dir, new Set(['keep.png']), Date.now())
  assert.equal(result.deleted, 1)
  assert.equal(result.freedBytes, 200)
  assert.ok(fs.existsSync(path.join(dir, 'keep.png')))
  assert.ok(!fs.existsSync(path.join(dir, 'orphan.png')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('cleanupOrphans keeps recently written files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-test-'))
  fs.writeFileSync(path.join(dir, 'fresh.png'), Buffer.alloc(50))
  const result = cleanupOrphans(dir, new Set(), Date.now())
  assert.equal(result.deleted, 0)
  assert.ok(fs.existsSync(path.join(dir, 'fresh.png')))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('cleanupOrphans tolerates a missing directory', () => {
  const result = cleanupOrphans(path.join(os.tmpdir(), 'uploads-missing-dir'), new Set(), Date.now())
  assert.deepEqual(result, { deleted: 0, freedBytes: 0 })
})

test('imageStats reports totals and orphans', () => {
  const dir = makeDir()
  const stats = imageStats(dir, new Set(['keep.png']))
  assert.equal(stats.totalFiles, 2)
  assert.equal(stats.totalBytes, 300)
  assert.equal(stats.orphanFiles, 1)
  assert.equal(stats.orphanBytes, 200)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('removeImages deletes only existing files', () => {
  const dir = makeDir()
  const result = removeImages(dir, ['orphan.png', 'missing.png'])
  assert.equal(result.deleted, 1)
  assert.equal(result.freedBytes, 200)
  assert.ok(fs.existsSync(path.join(dir, 'keep.png')))
  fs.rmSync(dir, { recursive: true, force: true })
})

const editRecord = {
  source_image: 'shot.png',
  size: '3840x2160',
  model_name: 'gpt-image-2',
  started_at: '2026-10-14T13:50:08.000Z',
  created_at: '2026-10-14T13:50:07.000Z'
}

const tasks = [
  { id: 'imgtask_late', status: 'success', endpoint: '/v1/images/generations', size: '3840x2160', model: 'gpt-image-2', created_at: '2026-10-14T13:50:20.000Z' },
  { id: 'imgtask_wrong_size', status: 'success', endpoint: '/v1/images/edits', size: '1024x1024', model: 'gpt-image-2', created_at: '2026-10-14T13:50:15.000Z' },
  { id: 'imgtask_running', status: 'running', endpoint: '/v1/images/edits', size: '3840x2160', model: 'gpt-image-2', created_at: '2026-10-14T13:50:09.000Z' },
  { id: 'imgtask_match', status: 'success', endpoint: '/v1/images/edits', size: '3840x2160', model: 'gpt-image-2', created_at: '2026-10-14T13:50:09.000Z' },
  { id: 'imgtask_far', status: 'success', endpoint: '/v1/images/edits', size: '3840x2160', model: 'gpt-image-2', created_at: '2026-10-14T13:40:00.000Z' }
]

test('findMatchingTask picks the closest successful upstream task', () => {
  const match = findMatchingTask(editRecord, tasks)
  assert.equal(match?.id, 'imgtask_match')
})

test('findMatchingTask ignores wrong endpoint, size, status and distant tasks', () => {
  const onlyBad = tasks.filter((t) => t.id !== 'imgtask_match')
  assert.equal(findMatchingTask(editRecord, onlyBad), null)
  assert.equal(findMatchingTask(editRecord, []), null)
  assert.equal(findMatchingTask({}, tasks), null)
})

test('findMatchingTask honours the time tolerance', () => {
  const match = findMatchingTask(editRecord, tasks, 500)
  assert.equal(match, null)
})
