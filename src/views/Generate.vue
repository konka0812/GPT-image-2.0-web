<template>
  <div class="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <section class="card flex min-h-0 flex-col rounded-3xl p-6">
      <h1 class="text-2xl font-black">AI 生图</h1>
      <p class="mt-2 text-sm text-slate-400">输入提示词生成图片</p>
      <div class="mt-6 flex min-h-0 flex-1 flex-col space-y-4">
        <textarea v-model="form.prompt" class="field min-h-0 flex-1 resize-none" placeholder="一只橘猫坐在赛博朋克霓虹街道上，旁边有「深夜食堂」招牌，中文清晰可读" />
        <select v-model="form.size" class="field"><option v-for="s in sizes" :key="s">{{ s }}</option></select>
        <div class="grid grid-cols-3 gap-3">
          <select v-model="form.quality" class="field"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
          <select v-model="form.output_format" class="field"><option value="png">png</option><option value="jpeg">jpeg</option><option value="webp">webp</option></select>
          <select v-model.number="form.n" class="field"><option v-for="n in [1,2,3,4]" :key="n" :value="n">{{ n }}张</option></select>
        </div>
        <button class="btn btn-primary w-full" :disabled="busy" @click="generate">{{ submitting ? '正在提交...' : loading ? '生成中...' : '开始生成' }}</button>
        <p v-if="notice" class="rounded-xl bg-cyan-500/15 p-3 text-sm text-cyan-100">{{ notice }}</p>
        <p v-if="error" class="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
      </div>
    </section>
    <section class="card flex min-h-0 flex-col rounded-3xl p-6">
      <div class="mb-5 flex items-center justify-between">
        <h2 class="text-xl font-bold">生成结果</h2>
        <span class="text-sm text-slate-400">{{ images.length }} 张</span>
      </div>
      <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 p-6"><TaskStatus :job="job" :elapsed="elapsed" :query-count="queryCount" title="正在生成图片" /></div>
      <div v-else-if="!images.length" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 text-slate-400">结果会显示在这里</div>
      <div v-else-if="images.length === 1" class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <img :src="images[0]" class="h-full w-full min-h-0 flex-1 object-contain" />
        <a :href="images[0]" download class="btn block shrink-0 border border-white/10 text-center text-cyan-200">下载图片</a>
      </div>
      <div v-else class="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-hidden">
        <div v-for="img in images" :key="img" class="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-black/30">
          <img :src="img" class="min-h-0 flex-1 object-contain" />
          <a :href="img" download class="block shrink-0 p-4 text-center text-sm font-bold text-cyan-200">下载图片</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'
import TaskStatus from '../components/TaskStatus.vue'
import { useImageTask } from '../use-image-task.js'

const sizes = ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2160x3840', '3840x2160']
const form = ref({ prompt: '', size: '3840x2160', quality: 'high', output_format: 'png', n: 1 })
const { job, images, error, notice, submitting, loading, busy, elapsed, queryCount, start } = useImageTask('generate')

async function generate() {
  error.value = ''
  if (busy.value) return
  submitting.value = true
  notice.value = '正在提交任务，请勿重复点击'
  try {
    const { data } = await axios.post('/api/images/generate', form.value)
    await start(data.jobId)
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    submitting.value = false
  }
}
</script>
