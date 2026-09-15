import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { collectImageNames, cleanupOrphans, imageStats, removeImages } from '../server/maintenance.js'

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
