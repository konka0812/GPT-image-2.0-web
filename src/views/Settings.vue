<template>
  <div class="card mx-auto max-w-2xl rounded-3xl p-6">
    <h1 class="text-2xl font-black">设置</h1>
    <p class="mt-2 text-sm text-slate-400">每个用户单独保存自己的 API 配置</p>
    <div class="mt-6 space-y-4">
      <input v-model="form.model" class="field" placeholder="模型名称，例如 gpt-image-2" />
      <input v-model="form.base_url" class="field" placeholder="Base URL" />
      <p class="text-xs text-slate-500">默认优先使用 https://testvideo.site/v1，失败自动切换 https://hk.testvideo.site/v1</p>
      <input v-model="form.api_key" class="field" type="password" placeholder="API Key" />
      <button class="btn btn-primary w-full" :disabled="loading" @click="save">{{ loading ? '保存中...' : '保存设置' }}</button>
      <p v-if="message" class="rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-200">{{ message }}</p>
      <p v-if="error" class="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { onMounted, ref } from 'vue'

const form = ref({ model: 'gpt-image-2', base_url: 'https://testvideo.site/v1', api_key: '' })
const loading = ref(false)
const message = ref('')
const error = ref('')

onMounted(async () => {
  const { data } = await axios.get('/api/settings')
  form.value = data
})

async function save() {
  loading.value = true
  message.value = ''
  error.value = ''
  try {
    await axios.post('/api/settings', form.value)
    message.value = '已保存'
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}
</script>
