<template>
  <div class="grid min-h-full gap-6 overflow-y-auto lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:overflow-hidden">
    <section class="card flex flex-col rounded-3xl p-6 lg:min-h-0">
      <div class="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-black">参考图生成</h1>
          <p class="mt-2 text-sm text-slate-400">上传 1-16 张参考图，结合提示词生成一张新图</p>
        </div>
        <button v-if="items.length" class="text-xs text-slate-400" type="button" @click="clearAll">清空</button>
      </div>

      <div class="mt-5 flex min-h-0 flex-1 flex-col gap-4">
        <input class="field shrink-0" type="file" accept="image/*" multiple @change="onFiles" />

        <div class="shrink-0 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          图片会按当前顺序编号为 Image 1、Image 2、Image 3…。请在提示词里通过编号说明用途，例如：“Image 1 作为背景，把 Image 2 放在左侧，Image 3 放在右下角”。拖动缩略图可以调整编号；位置由 AI 理解，不是精确像素坐标。
        </div>

        <div v-if="items.length" class="shrink-0 overflow-x-auto pb-2">
          <div class="flex gap-3">
            <article
              v-for="(item, index) in items"
              :key="item.id"
              class="w-28 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              draggable="true"
              @dragstart="dragIndex = index"
              @dragover.prevent
              @drop="dropAt(index)"
            >
              <div class="relative aspect-square">
                <img :src="item.preview" class="h-full w-full object-cover" />
                <span class="absolute left-1.5 top-1.5 rounded-md bg-black/80 px-1.5 py-1 text-[11px] font-bold text-white">Image {{ index + 1 }}</span>
                <button class="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-1 text-[11px] text-red-200" type="button" @click.stop="removeAt(index)">删除</button>
              </div>
              <div class="grid grid-cols-2 border-t border-white/10">
                <button class="py-1 text-xs text-slate-300 disabled:opacity-25" type="button" :disabled="index === 0" @click="moveAt(index, index - 1)">前移</button>
                <button class="border-l border-white/10 py-1 text-xs text-slate-300 disabled:opacity-25" type="button" :disabled="index === items.length - 1" @click="moveAt(index, index + 1)">后移</button>
              </div>
              <p class="truncate px-2 py-1.5 text-[11px] text-slate-300" :title="item.file.name">{{ item.file.name }}</p>
            </article>
          </div>
        </div>
        <div v-else class="flex h-28 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-slate-400">
          尚未添加参考图（最多 16 张）
        </div>

        <div class="relative flex shrink-0 flex-col">
          <textarea v-model="form.prompt" class="field min-h-24 flex-1 resize-none pr-10" placeholder="例如：Image 1 作为背景，把 Image 2 的人物放在左侧，Image 3 的商品放在右下角，统一光影和透视" />
          <PromptOptimizer v-model="form.prompt" type="reference" />
        </div>
        <select v-model="form.size" class="field shrink-0"><option v-for="size in sizes" :key="size">{{ size }}</option></select>
        <div class="grid shrink-0 grid-cols-2 gap-3">
          <select v-model="form.quality" class="field"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
          <select v-model="form.output_format" class="field"><option value="png">png</option><option value="jpeg">jpeg</option><option value="webp">webp</option></select>
        </div>
        <button class="btn btn-primary w-full shrink-0" :disabled="busy" @click="generate">{{ submitting ? '正在提交...' : loading ? '生成中...' : '生成新图' }}</button>
        <p v-if="notice" class="shrink-0 rounded-xl bg-cyan-500/15 p-3 text-sm text-cyan-100">{{ notice }}</p>
        <p v-if="error" class="shrink-0 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{{ error }}</p>
      </div>
    </section>

    <section class="card flex min-h-[60vh] flex-col rounded-3xl p-6 lg:min-h-0">
      <h2 class="mb-4 shrink-0 text-xl font-bold">生成结果</h2>
      <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 p-6"><TaskStatus :job="job" :elapsed="elapsed" :query-count="queryCount" title="正在根据参考图生成" /></div>
      <div v-else-if="!images.length" class="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 text-slate-400">结果会显示在这里</div>
      <div v-else class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <img :src="images[0]" class="h-full w-full min-h-0 flex-1 object-contain" />
        <a :href="images[0]" download class="btn block shrink-0 border border-white/10 text-center text-cyan-200">下载图片</a>
      </div>
    </section>
  </div>
</template>

<script setup>
import axios from 'axios'
import { onBeforeUnmount, ref } from 'vue'
import { appendReferenceFiles, maxReferenceImages, moveReferenceFile, removeReferenceFile } from '../reference-images.js'
import TaskStatus from '../components/TaskStatus.vue'
import PromptOptimizer from '../components/PromptOptimizer.vue'
import { useImageTask } from '../use-image-task.js'

const sizes = ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2160x3840', '3840x2160']
const form = ref({ prompt: '', size: '3840x2160', quality: 'high', output_format: 'png' })
const items = ref([])
const { job, images, error, notice, submitting, loading, busy, elapsed, queryCount, start } = useImageTask('reference')
const dragIndex = ref(-1)

function onFiles(event) {
  const incoming = Array.from(event.target.files || [])
  const imageFiles = incoming.filter((file) => file.type.startsWith('image/'))
  if (imageFiles.length !== incoming.length) error.value = '只支持图片文件'
  else if (items.value.length + imageFiles.length > maxReferenceImages) error.value = '最多上传 16 张参考图，超出的图片未添加'
  else error.value = ''
  const additions = imageFiles.map((file) => ({ file, preview: URL.createObjectURL(file), id: `${Date.now()}-${Math.random()}` }))
  const accepted = appendReferenceFiles(items.value, additions)
  additions.slice(accepted.length - items.value.length).forEach((item) => URL.revokeObjectURL(item.preview))
  items.value = accepted
  images.value = []
  event.target.value = ''
}

function dropAt(index) {
  if (dragIndex.value < 0) return
  items.value = moveReferenceFile(items.value, dragIndex.value, index)
  dragIndex.value = -1
}

function moveAt(from, to) {
  items.value = moveReferenceFile(items.value, from, to)
  images.value = []
}

function removeAt(index) {
  URL.revokeObjectURL(items.value[index].preview)
  items.value = removeReferenceFile(items.value, index)
  images.value = []
}

function clearAll() {
  items.value.forEach((item) => URL.revokeObjectURL(item.preview))
  items.value = []
  images.value = []
}

async function generate() {
  error.value = ''
  if (!items.value.length) return (error.value = '请至少上传 1 张参考图')
  if (!form.value.prompt.trim()) return (error.value = '请输入提示词')
  if (busy.value) return
  submitting.value = true
  notice.value = '正在上传参考图并提交任务，请勿重复点击'
  images.value = []
  try {
    const data = new FormData()
    items.value.forEach((item) => data.append('files', item.file))
    Object.entries(form.value).forEach(([key, value]) => data.append(key, value))
    const response = await axios.post('/api/images/reference', data)
    await start(response.data.jobId)
  } catch (requestError) {
    error.value = requestError.response?.data?.error || requestError.message
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(clearAll)
</script>
