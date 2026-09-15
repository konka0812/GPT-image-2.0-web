<template>
  <div class="card mx-auto h-full max-w-6xl overflow-y-auto rounded-3xl p-8">
    <h1 class="text-2xl font-black">设置</h1>
    <p class="mt-2 text-sm text-slate-400">每个用户单独保存自己的 API 配置</p>
    <div class="mt-8 space-y-6">
      <section>
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-200">图片通道</h2>
            <p class="mt-1 text-xs text-slate-500">每个分组独立 API Key，每个模型单独勾选支持的尺寸；生图页可选择使用哪个通道</p>
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
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <label v-for="size in sizeOptions" :key="size.value" class="flex items-center gap-1.5 text-xs text-slate-300">
                  <input v-model="model.sizes" type="checkbox" :value="size.value" />
                  {{ size.label }}
                </label>
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

      <button class="btn btn-primary w-full" :disabled="loading" @click="save">{{ loading ? '保存中...' : '保存设置' }}</button>
      <p v-if="error" class="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
    </div>
    <div v-if="savedVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" @click="savedVisible = false">
      <div class="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 text-center" @click.stop>
        <p class="text-lg font-bold text-emerald-300">保存成功</p>
        <p class="mt-2 text-sm text-slate-400">配置已更新，生图页可直接选择新的通道</p>
        <button class="btn btn-primary mt-5 w-full" @click="savedVisible = false">知道了</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { onMounted, ref } from 'vue'
import { sizeOptions } from '../image-sizes.js'

const form = ref({ image_channels: [], text_model: '', text_base_url: '', text_api_key: '' })
const loading = ref(false)
const savedVisible = ref(false)
const error = ref('')

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function newModel() {
  return { id: makeId('md'), name: 'gpt-image-2', sizes: sizeOptions.map((option) => option.value) }
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
  model.sizes = sizeOptions.map((option) => option.value)
}

function clearSizes(model) {
  model.sizes = []
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

onMounted(async () => {
  const { data } = await axios.get('/api/settings')
  form.value = {
    image_channels: data.image_channels || [],
    text_model: data.text_model || '',
    text_base_url: data.text_base_url || '',
    text_api_key: data.text_api_key || ''
  }
})

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
    savedVisible.value = true
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}
</script>
