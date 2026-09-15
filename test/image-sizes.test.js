import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { sizeCatalog, tierOrder, ratioOrder } from '../src/image-sizes.js'
import { sizes } from '../server/utils.js'

const expected = {
  '1K': { '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536', '4:3': '1360x1024', '3:4': '1024x1360', '16:9': '1536x864', '9:16': '864x1536' },
  '2K': { '1:1': '2048x2048', '3:2': '2048x1360', '2:3': '1360x2048', '4:3': '2048x1536', '3:4': '1536x2048', '16:9': '2048x1152', '9:16': '1152x2048' },
  '4K': { '1:1': '2880x2880', '3:2': '3520x2336', '2:3': '2336x3520', '4:3': '3312x2480', '3:4': '2480x3312', '16:9': '3840x2160', '9:16': '2160x3840' }
}

test('catalog covers three tiers and seven ratios with unique sizes', () => {
  assert.equal(sizeCatalog.length, 21)
  assert.deepEqual(tierOrder, ['1K', '2K', '4K'])
  assert.equal(new Set(sizeCatalog.map((entry) => entry.value)).size, 21)
  assert.equal(new Set(sizeCatalog.map((entry) => `${entry.tier}:${entry.ratio}`)).size, 21)
  for (const entry of sizeCatalog) {
    assert.ok(tierOrder.includes(entry.tier), entry.value)
    assert.ok(ratioOrder.includes(entry.ratio), entry.value)
    assert.match(entry.name, /^(横版|竖版|方图)$/, entry.value)
  }
})

test('catalog matches verified pixel table', () => {
  for (const [tier, ratios] of Object.entries(expected)) {
    for (const [ratio, value] of Object.entries(ratios)) {
      const entry = sizeCatalog.find((item) => item.tier === tier && item.ratio === ratio)
      assert.ok(entry, `${tier} ${ratio} missing`)
      assert.equal(entry.value, value, `${tier} ${ratio}`)
    }
  }
})

test('server validates every catalog size', () => {
  for (const entry of sizeCatalog) assert.ok(sizes.includes(entry.value), `server missing ${entry.value}`)
  assert.ok(!sizes.includes('2880x2160'), 'legacy 2880x2160 should be removed')
  assert.ok(!sizes.includes('2160x2880'), 'legacy 2160x2880 should be removed')
})

test('settings page groups size checkboxes by tier', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /tierOrder/)
  assert.match(source, /sizeCatalog/)
})
