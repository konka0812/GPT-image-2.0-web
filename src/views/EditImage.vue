<template>
  <div class="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <section class="card flex min-h-0 flex-col rounded-3xl p-6">
      <h1 class="text-2xl font-black">AI 改图</h1>
      <p class="mt-2 text-sm text-slate-400">上传单张图片进行编辑</p>
      <div class="mt-6 flex min-h-0 flex-1 flex-col space-y-4">
        <input class="field" type="file" accept="image/*" @change="onFile" />
        <textarea v-model="form.prompt" class="field min-h-0 flex-1 resize-none" placeholder="把背景换成纯白色，保持商品主体不变，添加柔和底部阴影" />
        <select v-model="form.size" class="field"><option v-for="s in sizes" :key="s">{{ s }}</option></select>
        <div class="grid grid-cols-2 gap-3">
          <select v-model="form.quality" class="field"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
          <select v-model="form.output_format" class="field"><option value="png">png</option><option value="jpeg">jpeg</option><option value="webp">webp</option></select>
        </div>
        <button class="btn btn-primary w-full" :disabled="loading" @click="edit">{{ loading ? '处理中...' : '开始改图' }}</button>
        <p v-if="error" class="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
      </div>
    </section>
    <section class="grid min-h-0 gap-6 xl:grid-cols-2">
      <div class="card flex min-h-0 flex-col rounded-3xl p-6">
        <h2 class="mb-4 shrink-0 text-xl font-bold">原图</h2>
        <div class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-dashed border-white/15 text-slate-400">
          <img v-if="preview" :src="preview" class="max-h-full w-full object-contain" />
          <span v-else>原图预览</span>
        </div>
      </div>
      <div class="card flex min-h-0 flex-col rounded-3xl p-6">
        <h2 class="mb-4 shrink-0 text-xl font-bold">结果</h2>
        <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 text-slate-400">正在改图</div>
        <div v-else-if="!images.length" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 text-slate-400">结果会显示在这里</div>
        <div v-else class="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
          <img :src="images[0]" class="min-h-0 flex-1 rounded-3xl object-contain" />
          <a :href="images[0]" download class="btn block shrink-0 border border-white/10 text-center text-cyan-200">下载图片</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'

const sizes = ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2160x3840', '3840x2160']
const form = ref({ prompt: '', size: '1024x1024', quality: 'low', output_format: 'png' })
const file = ref(null)
const preview = ref('')
const images = ref([])
const error = ref('')
const loading = ref(false)

function onFile(e) {
  file.value = e.target.files?.[0] || null
  preview.value = file.value ? URL.createObjectURL(file.value) : ''
  images.value = []
}

async function edit() {
  error.value = ''
  loading.value = true
  try {
    const data = new FormData()
    Object.entries(form.value).forEach(([k, v]) => data.append(k, v))
    if (!file.value) throw new Error('请先上传图片文件')
    data.append('file', file.value)
    const res = await axios.post('/api/images/edit', data)
    images.value = res.data.images
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}
</script>
