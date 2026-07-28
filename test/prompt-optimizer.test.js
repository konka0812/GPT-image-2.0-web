import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('prompt optimizer exposes optimize-prompt endpoint', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /app\.post\('\/api\/optimize-prompt'/)
  assert.match(source, /optimizePrompt/)
})

test('settings API includes text model fields', async () => {
  const source = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /text_model/)
  assert.match(source, /text_base_url/)
  assert.match(source, /text_api_key/)
})

test('system prompts contain key structures for generate and edit', async () => {
  const source = await fs.readFile(new URL('../server/prompt-optimizer.js', import.meta.url), 'utf8')
  assert.match(source, /主体/)
  assert.match(source, /构图/)
  assert.match(source, /必须保持不变/)
  assert.match(source, /只修改/)
  assert.match(source, /参考图/)
  assert.match(source, /编号/)
  assert.match(source, /只输出优化后的提示词/)
})

test('settings page includes text model config section', async () => {
  const source = await fs.readFile(new URL('../src/views/Settings.vue', import.meta.url), 'utf8')
  assert.match(source, /文本模型/)
  assert.match(source, /text_model/)
  assert.match(source, /text_base_url/)
  assert.match(source, /text_api_key/)
})

test('all generation pages include the prompt optimizer component', async () => {
  const views = ['Generate.vue', 'EditImage.vue', 'ReferenceGenerate.vue', 'BatchEdit.vue']
  for (const name of views) {
    const source = await fs.readFile(new URL(`../src/views/${name}`, import.meta.url), 'utf8')
    assert.match(source, /PromptOptimizer/, `${name} missing PromptOptimizer`)
  }
})
