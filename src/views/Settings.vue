<template>
  <div class="card mx-auto h-full max-w-6xl overflow-y-auto rounded-3xl p-8">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black">设置</h1>
        <p class="mt-2 text-sm text-slate-400">每个用户单独保存自己的 API 配置</p>
      </div>
      <button
        v-if="!editing"
        class="shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        @click="startEdit"
      >编辑配置</button>
      <span v-else class="shrink-0 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200">编辑中</span>
    </div>

    <div v-if="!editing" class="mt-8 space-y-6">
      <section>
        <h2 class="text-lg font-bold text-slate-200">图片通道</h2>
        <p class="mt-1 text-xs text-slate-500">生图页可选择使用哪个站点、哪个分组、哪个模型</p>
        <div v-if="form.image_channels.length" class="mt-4 space-y-3">
          <div v-for="channel in form.image_channels" :key="channel.id" class="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-bold text-slate-100">{{ channel.name || '未命名站点' }}</p>
              <p class="font-mono text-xs text-slate-500">{{ channel.base_url }}</p>
            </div>
            <div v-for="group in channel.groups" :key="group.id" class="mt-3 rounded-xl border border-white/10 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs font-semibold text-slate-200">{{ group.name || '未命名分组' }}</p>
                <p class="font-mono text-[11px] text-slate-500">{{ maskKey(group.api_key) }}</p>
              </div>
              <div v-for="model in group.models" :key="model.id" class="mt-2.5 space-y-1">
                <p class="text-xs font-semibold text-cyan-200">{{ model.name }}</p>
                <div v-for="tier in tierOrder" :key="tier" class="flex flex-wrap items-center gap-1.5">
                  <template v-if="sizesInTier(model.sizes, tier).length">
                    <span class="text-[11px] font-bold text-slate-500">{{ tier }}</span>
                    <span v-for="entry in sizesInTier(model.sizes, tier)" :key="entry.value" :title="formatPixels(entry.value)" class="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{{ entry.ratio }} {{ entry.name }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">还没有配置图片通道，点击右上角「编辑配置」开始添加</p>
      </section>

      <section class="border-t border-white/10 pt-6">
        <h2 class="text-lg font-bold text-slate-200">文本模型</h2>
        <p class="mt-1 text-xs text-slate-500">用于提示词优化，独立于图片模型</p>
        <div class="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
          <template v-if="form.text_model || form.text_base_url || form.text_api_key">
            <p class="text-slate-300">模型：{{ form.text_model || '未填写' }}</p>
            <p class="mt-1.5 text-slate-300">Base URL：{{ form.text_base_url || '未填写' }}</p>
            <p class="mt-1.5 text-slate-300">API Key：{{ maskKey(form.text_api_key) }}</p>
          </template>
          <p v-else class="text-slate-400">未配置文本模型，提示词优化暂不可用</p>
        </div>
      </section>
      <section class="border-t border-white/10 pt-6">
        <h2 class="text-lg font-bold text-slate-200">维护</h2>
        <p class="mt-1 text-xs text-slate-500">删除历史记录时会同时删除对应图片；如仍有残留，可在这里清理没有被任何记录引用的图片</p>
        <div class="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p v-if="stats" class="text-sm leading-6 text-slate-300">
            图片文件：{{ stats.totalFiles }} 个 · 占用 {{ formatBytes(stats.totalBytes) }}<br />
            <span :class="stats.orphanFiles ? 'text-amber-300' : 'text-slate-500'">无用文件：{{ stats.orphanFiles }} 个 · {{ formatBytes(stats.orphanBytes) }}</span>
          </p>
          <p v-else class="text-sm text-slate-400">正在读取磁盘占用…</p>
          <button
            class="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 disabled:opacity-40"
            :disabled="cleaning || !stats || !stats.orphanFiles"
            @click="cleanupImages"
          >{{ cleaning ? '清理中...' : '清理无用图片' }}</button>
        </div>
      </section>
    </div>

    <div v-else class="mt-8 space-y-6">
      <section>
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-200">图片通道</h2>
            <p class="mt-1 text-xs text-slate-500">每个分组独立 API Key，每个模型单独勾选支持的尺寸</p>
          </div>
          <button class="shrink-0 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-cyan-200" @click="addChannel">+ 添加站点</button>
        </div>

        <div v-for="(channel, ci) in form.image_channels" :key="channel.id" class="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <input v-model="channel.name" class="field flex-1" placeholder="站点名称，例如 站A" />
            <input v-model="channel.base_url" class="field flex-[2]" placeholder="Base URL，例如 https://api.example.com/v1" />
            <button class="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200" @click="removeChannel(ci)">删除站点</button>
          </div>

          <div v-for="(group, gi) in channel.groups" :key="group.id" class="mt-3 rounded-xl border border-white/10 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <input v-model="group.name" class="field flex-1" placeholder="分组名称，例如 便宜1K分组" />
              <input v-model="group.api_key" class="field flex-[2]" type="password" placeholder="该分组的 API Key" />
              <button class="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200" @click="removeGroup(ci, gi)">删除分组</button>
            </div>

            <div v-for="(model, mi) in group.models" :key="model.id" class="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <input v-model="model.name" class="field flex-1" placeholder="模型名，例如 gpt-image-2" />
                <button class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300" @click="selectAllSizes(model)">全选尺寸</button>
                <button class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300" @click="clearSizes(model)">清空尺寸</button>
                <button class="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200" @click="removeModel(ci, gi, mi)">删除模型</button>
              </div>
              <div class="mt-2 space-y-2">
                <div v-for="tier in tierOrder" :key="tier" class="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span class="w-8 shrink-0 text-xs font-bold text-slate-500">{{ tier }}</span>
                  <label v-for="entry in catalogForTier(tier)" :key="entry.value" :title="formatPixels(entry.value)" class="flex items-center gap-1.5 text-xs text-slate-300">
                    <input v-model="model.sizes" type="checkbox" :value="entry.value" />
                    {{ entry.ratio }} {{ entry.name }}
                  </label>
                </div>
              </div>
              <p v-if="!model.sizes.length" class="mt-2 text-xs text-amber-300">请至少勾选一个尺寸</p>
            </div>

            <button class="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cyan-200" @click="addModel(ci, gi)">+ 添加模型</button>
          </div>

          <button class="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cyan-200" @click="addGroup(ci)">+ 添加分组</button>
        </div>

        <p v-if="!form.image_channels.length" class="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">还没有图片通道，点击右上角「添加站点」开始配置</p>
      </section>

      <section class="border-t border-white/10 pt-6">
        <h2 class="mb-1 text-lg font-bold text-slate-200">文本模型</h2>
        <p class="mb-4 text-xs text-slate-500">用于提示词优化，独立于图片模型</p>
        <div class="space-y-3">
          <input v-model="form.text_model" class="field" placeholder="文本模型名称，例如 gpt-4o" />
          <input v-model="form.text_base_url" class="field" placeholder="文本模型 Base URL" />
          <input v-model="form.text_api_key" class="field" type="password" placeholder="文本模型 API Key" />
        </div>
      </section>

      <div class="flex gap-3">
        <button class="btn flex-1 border border-white/10" :disabled="loading" @click="cancelEdit">取消</button>
        <button class="btn btn-primary flex-1" :disabled="loading" @click="save">{{ loading ? '保存中...' : '保存设置' }}</button>
      </div>
      <p v-if="error" class="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
    </div>

    <div v-if="dialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm" @click="dialog = null">
      <div class="save-dialog w-full max-w-md overflow-hidden rounded-3xl border border-emerald-400/25 bg-slate-900 shadow-2xl" @click.stop>
        <div class="bg-gradient-to-b from-emerald-500/20 to-transparent px-8 pb-4 pt-8 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
            <svg class="h-8 w-8 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3 class="mt-5 text-xl font-black text-white">{{ dialog.title }}</h3>
          <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">{{ dialog.message }}</p>
        </div>
        <div class="px-8 pb-8 pt-2">
          <button class="btn btn-primary w-full" @click="dialog = null">知道了</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { onMounted, ref } from 'vue'
import { formatPixels, sizeCatalog, tierOrder } from '../image-sizes.js'

const form = ref({ image_channels: [], text_model: '', text_base_url: '', text_api_key: '' })
const editing = ref(false)
const loading = ref(false)
const dialog = ref(null)
const stats = ref(null)
const cleaning = ref(false)
const error = ref('')

function showDialog(title, message) {
  dialog.value = { title, message }
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value}B`
  if (value < 1048576) return `${(value / 1024).toFixed(0)}KB`
  if (value < 1073741824) return `${(value / 1048576).toFixed(1)}MB`
  return `${(value / 1073741824).toFixed(2)}GB`
}

async function loadStats() {
  try {
    const { data } = await axios.get('/api/maintenance/image-stats')
    stats.value = data
  } catch {
    stats.value = null
  }
}

async function cleanupImages() {
  if (!confirm('确定清理没有被任何历史记录引用的图片吗？此操作不可撤销。')) return
  cleaning.value = true
  try {
    const { data } = await axios.post('/api/maintenance/cleanup-images')
    await loadStats()
    showDialog('清理完成', `已删除 ${data.deleted} 个文件\n释放 ${formatBytes(data.freedBytes)} 空间`)
  } catch (e) {
    showDialog('清理失败', e.response?.data?.error || e.message)
  } finally {
    cleaning.value = false
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function newModel() {
  return { id: makeId('md'), name: 'gpt-image-2', sizes: sizeCatalog.map((entry) => entry.value) }
}

function newGroup() {
  return { id: makeId('gr'), name: '', api_key: '', models: [newModel()] }
}

function addChannel() {
  form.value.image_channels.push({ id: makeId('ch'), name: '', base_url: '', groups: [newGroup()] })
}

function removeChannel(index) {
  form.value.image_channels.splice(index, 1)
}

function addGroup(channelIndex) {
  form.value.image_channels[channelIndex].groups.push(newGroup())
}

function removeGroup(channelIndex, groupIndex) {
  form.value.image_channels[channelIndex].groups.splice(groupIndex, 1)
}

function addModel(channelIndex, groupIndex) {
  form.value.image_channels[channelIndex].groups[groupIndex].models.push(newModel())
}

function removeModel(channelIndex, groupIndex, modelIndex) {
  form.value.image_channels[channelIndex].groups[groupIndex].models.splice(modelIndex, 1)
}

function selectAllSizes(model) {
  model.sizes = sizeCatalog.map((entry) => entry.value)
}

function clearSizes(model) {
  model.sizes = []
}

function catalogForTier(tier) {
  return sizeCatalog.filter((entry) => entry.tier === tier)
}

function sizesInTier(values, tier) {
  const set = new Set(Array.isArray(values) ? values : [])
  return catalogForTier(tier).filter((entry) => set.has(entry.value))
}

function maskKey(key) {
  const value = String(key || '')
  if (!value) return '未填写'
  if (value.length <= 8) return '••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

function validate() {
  const channels = form.value.image_channels
  if (!channels.length) return '请至少添加一个站点'
  for (const channel of channels) {
    if (!channel.base_url.trim()) return `请填写站点「${channel.name || '未命名站点'}」的 Base URL`
    if (!channel.groups.length) return `站点「${channel.name || '未命名站点'}」至少需要一个分组`
    for (const group of channel.groups) {
      if (!group.api_key.trim()) return `请填写「${channel.name || '未命名站点'}」下分组「${group.name || '未命名分组'}」的 API Key`
      if (!group.models.length) return `分组「${group.name || '未命名分组'}」至少需要一个模型`
      for (const model of group.models) {
        if (!model.name.trim()) return '模型名称不能为空'
        if (!model.sizes.length) return `模型「${model.name}」请至少勾选一个尺寸`
      }
    }
  }
  return ''
}

async function load() {
  const { data } = await axios.get('/api/settings')
  form.value = {
    image_channels: data.image_channels || [],
    text_model: data.text_model || '',
    text_base_url: data.text_base_url || '',
    text_api_key: data.text_api_key || ''
  }
}

function startEdit() {
  error.value = ''
  editing.value = true
}

async function cancelEdit() {
  error.value = ''
  await load()
  editing.value = false
}

async function save() {
  error.value = ''
  const problem = validate()
  if (problem) {
    error.value = problem
    return
  }
  loading.value = true
  try {
    await axios.post('/api/settings', form.value)
    editing.value = false
    showDialog('保存成功', '配置已更新\n生图页可直接选择新的通道')
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  await loadStats()
})
</script>

<style scoped>
.save-dialog {
  animation: dialog-pop 180ms ease-out;
}

@keyframes dialog-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
