<template>
  <div class="grid h-full min-h-0 gap-6 lg:grid-cols-[420px_1fr]">
    <section class="card flex min-h-0 flex-col rounded-3xl p-6">
      <h1 class="text-2xl font-black">批量改图</h1>
      <p class="mt-2 text-sm text-slate-400">一次上传多张图片，使用同一个提示词并发处理</p>
      <div class="mt-6 flex min-h-0 flex-1 flex-col space-y-4">
        <input class="field" type="file" accept="image/*" multiple :disabled="loading" @change="onFiles" />
        <div class="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">已选择 {{ files.length }} 张图片</div>
        <div v-if="jobId" class="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="text-cyan-100">进度 {{ completed }} / {{ total }}</span>
            <span class="text-cyan-200">{{ progress }}%</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-white/10">
            <div class="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="mt-2 text-xs text-slate-400">运行中 {{ running }}，成功 {{ successCount }}，失败 {{ failedCount }}，已查询 {{ queryCount }} 次</div>
        </div>
        <textarea v-model="form.prompt" class="field min-h-0 flex-1 resize-none" placeholder="把背景换成纯白色，保持商品主体不变，添加柔和底部阴影" />
        <select v-model="form.size" class="field"><option v-for="s in sizes" :key="s">{{ s }}</option></select>
        <div class="grid grid-cols-2 gap-3">
          <select v-model="form.quality" class="field"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
          <select v-model="form.output_format" class="field"><option value="png">png</option><option value="jpeg">jpeg</option><option value="webp">webp</option></select>
        </div>
        <button class="btn btn-primary w-full" :disabled="loading" @click="edit()">{{ loading ? '批量处理中...' : '开始批量改图' }}</button>
        <p v-if="notice" class="rounded-xl bg-cyan-500/15 p-3 text-sm text-cyan-100">{{ notice }}</p>
        <p v-if="error" class="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
      </div>
    </section>
    <section class="card flex min-h-0 flex-col rounded-3xl p-6">
      <div class="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold">批量结果</h2>
          <p class="mt-1 text-sm text-slate-400">成功 {{ successCount }} / 共 {{ results.length }}</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-xl border border-white/10 px-4 py-2 text-sm" :disabled="!successCount" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
          <button class="rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-200" :disabled="loading || !failedCount" @click="retryFailed">重试失败</button>
          <button class="rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-200" :disabled="!selectedImages.length" @click="downloadSelected">下载选中</button>
        </div>
      </div>
      <div v-if="!results.length" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 text-slate-400">结果会显示在这里</div>
      <div v-else class="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-y-auto pr-2 xl:grid-cols-3">
        <div v-for="item in results" :key="item.index" class="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
          <label v-if="item.images?.length" class="block cursor-pointer">
            <input v-model="selected" type="checkbox" :value="item.images[0]" class="absolute m-3 h-5 w-5" />
            <img :src="item.images[0]" class="aspect-square w-full object-cover" @click.prevent="preview = item.images[0]" />
          </label>
          <div v-else class="flex aspect-square items-center justify-center p-4 text-center text-sm" :class="item.status === 'failed' ? 'text-red-300' : 'text-slate-400'">{{ item.progressText || (item.status === 'running' ? '处理中...' : item.status === 'queued' ? '排队中...' : item.error || '处理失败') }}</div>
          <div class="space-y-2 p-3">
            <div class="truncate text-sm text-slate-300">{{ item.name }}</div>
            <div class="text-xs" :class="statusClass(item.status)">{{ statusText(item.status) }}</div>
            <div v-if="item.progressText" class="line-clamp-2 text-xs text-slate-400">{{ item.progressText }}</div>
            <a v-if="item.images?.length" :href="item.images[0]" download class="block rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-cyan-200">单张下载</a>
          </div>
        </div>
      </div>
    </section>
    <div v-if="preview" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8" @click="preview = ''">
      <img :src="preview" class="max-h-[88vh] max-w-full rounded-3xl object-contain" />
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import JSZip from 'jszip'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { taskStorageKey } from '../task-feedback.js'

const sizes = ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2160x3840', '3840x2160']
const form = ref({ prompt: '', size: '3840x2160', quality: 'high', output_format: 'png' })
const files = ref([])
const results = ref([])
const selected = ref([])
const preview = ref('')
const error = ref('')
const notice = ref('')
const loading = ref(false)
const jobId = ref('')
const total = ref(0)
const completed = ref(0)
const running = ref(0)
const queryCount = ref(0)
let timer = null
let stopped = true
const successCount = computed(() => results.value.filter((item) => item.status === 'success' && item.images?.length).length)
const failedCount = computed(() => results.value.filter((item) => item.status === 'failed').length)
const progress = computed(() => total.value ? Math.round((completed.value / total.value) * 100) : 0)
const selectedImages = computed(() => selected.value)
const allSelected = computed(() => successCount.value > 0 && selected.value.length === successCount.value)

function onFiles(e) {
  files.value = Array.from(e.target.files || [])
  results.value = []
  selected.value = []
  jobId.value = ''
  total.value = files.value.length
  completed.value = 0
  running.value = 0
}

function statusText(status) {
  return ({ queued: '排队中', running: '处理中', success: '成功', failed: '失败' })[status] || status
}

function statusClass(status) {
  return status === 'success' ? 'text-emerald-300' : status === 'failed' ? 'text-red-300' : 'text-cyan-300'
}

function toggleAll() {
  selected.value = allSelected.value ? [] : results.value.flatMap((item) => item.images?.[0] ? [item.images[0]] : [])
}

function stopPolling() {
  stopped = true
  if (timer) clearTimeout(timer)
  timer = null
}

async function pollJob() {
  if (!jobId.value || stopped) return
  try {
    const { data } = await axios.get(`/api/images/edit/batch/${jobId.value}`)
    total.value = data.total
    completed.value = data.completed
    running.value = data.running
    queryCount.value = data.queryCount || queryCount.value + 1
    results.value = data.results
    if (data.status !== 'running') {
      loading.value = false
      sessionStorage.removeItem(taskStorageKey('batch'))
      stopPolling()
    }
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message
    if (requestError.response?.status === 404) {
      loading.value = false
      sessionStorage.removeItem(taskStorageKey('batch'))
      stopPolling()
    }
  }
}

function schedulePoll() {
  if (stopped || !loading.value) return
  timer = setTimeout(async () => {
    await pollJob()
    schedulePoll()
  }, 1500)
}

async function edit(targetFiles = files.value) {
  error.value = ''
  loading.value = true
  notice.value = '正在上传图片并提交批量任务，请勿重复点击'
  selected.value = []
  results.value = []
  completed.value = 0
  running.value = 0
  try {
    if (!targetFiles.length) throw new Error('请先上传图片文件')
    const data = new FormData()
    Object.entries(form.value).forEach(([k, v]) => data.append(k, v))
    targetFiles.forEach((file) => data.append('files', file))
    const res = await axios.post('/api/images/edit/batch', data)
    jobId.value = res.data.jobId
    sessionStorage.setItem(taskStorageKey('batch'), jobId.value)
    notice.value = `批量任务已提交（${jobId.value}），请勿重复点击`
    total.value = targetFiles.length
    results.value = targetFiles.map((file, index) => ({ index, name: file.name, status: 'queued', progressText: '排队中', images: [] }))
    stopPolling()
    stopped = false
    await pollJob()
    schedulePoll()
  } catch (e) {
    error.value = e.response?.data?.error || e.message
    loading.value = false
    stopPolling()
  }
}

async function retryFailed() {
  const failedNames = new Set(results.value.filter((item) => item.status === 'failed').map((item) => item.name))
  const retryFiles = files.value.filter((file) => failedNames.has(file.name))
  await edit(retryFiles)
}

async function downloadSelected() {
  const zip = new JSZip()
  await Promise.all(selectedImages.value.map(async (url, index) => {
    const response = await fetch(url)
    const blob = await response.blob()
    const ext = url.split('.').pop() || form.value.output_format
    zip.file(`edited-${index + 1}.${ext}`, blob)
  }))
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'edited-images.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}

onMounted(() => {
  const savedJobId = sessionStorage.getItem(taskStorageKey('batch'))
  if (!savedJobId) return
  jobId.value = savedJobId
  loading.value = true
  stopped = false
  void pollJob().then(schedulePoll)
})
onBeforeUnmount(stopPolling)
</script>
