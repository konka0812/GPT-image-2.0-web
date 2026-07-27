<template>
  <div class="flex h-full min-h-0 flex-col space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-black">历史记录</h1>
      <div class="flex gap-2">
        <button class="rounded-xl border border-white/10 px-4 py-2 text-sm" @click="load">刷新</button>
        <button class="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200" @click="clearHistory">一键清空</button>
      </div>
    </div>
    <section class="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
      <div class="card min-h-0 overflow-hidden rounded-3xl p-6">
        <h2 class="mb-4 text-xl font-bold">生图记录</h2>
        <div class="flex max-h-[calc(100%-3rem)] flex-col gap-3 overflow-y-auto pr-2">
          <RecordCard v-for="item in generations" :key="'g'+item.id" :item="item" @preview="openPreview" />
        </div>
        <p v-if="!generations.length" class="text-slate-400">暂无记录</p>
      </div>
      <div class="card min-h-0 overflow-hidden rounded-3xl p-6">
        <h2 class="mb-4 text-xl font-bold">改图记录</h2>
        <div class="flex max-h-[calc(100%-3rem)] flex-col gap-3 overflow-y-auto pr-2">
          <RecordCard v-for="item in edits" :key="'e'+item.id" :item="item" @preview="openPreview" />
        </div>
        <p v-if="!edits.length" class="text-slate-400">暂无记录</p>
      </div>
    </section>
    <div v-if="previewImages.length" class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" @click="closePreview">
      <div class="flex max-h-full max-w-6xl flex-col gap-4" @click.stop>
        <img :src="previewImages[previewIndex]" class="max-h-[82vh] max-w-full rounded-3xl object-contain" />
        <div class="flex items-center justify-center gap-3">
          <button v-if="previewImages.length > 1" class="btn border border-white/10" @click="previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length">上一张</button>
          <span v-if="previewImages.length > 1" class="text-sm text-slate-300">{{ previewIndex + 1 }} / {{ previewImages.length }}</span>
          <button v-if="previewImages.length > 1" class="btn border border-white/10" @click="previewIndex = (previewIndex + 1) % previewImages.length">下一张</button>
          <a :href="previewImages[previewIndex]" download class="btn btn-primary">下载原图</a>
          <button class="btn border border-white/10" @click="closePreview">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import RecordCard from '../components/RecordCard.vue'

const generations = ref([])
const edits = ref([])
const previewImages = ref([])
const previewIndex = ref(0)
let refreshTimer
let loadSequence = 0
async function load() {
  const sequence = ++loadSequence
  const { data } = await axios.get('/api/history')
  if (sequence !== loadSequence) return
  generations.value = data.generations
  edits.value = data.edits
}
function openPreview(images) {
  previewImages.value = images
  previewIndex.value = 0
}
function closePreview() {
  previewImages.value = []
  previewIndex.value = 0
}
async function clearHistory() {
  if (!confirm('确定清空所有历史记录吗？')) return
  await axios.delete('/api/history')
  generations.value = []
  edits.value = []
}
onMounted(() => {
  load()
  refreshTimer = setInterval(() => {
    if ([...generations.value, ...edits.value].some((item) => item.status === 'running')) load()
  }, 3000)
})
onBeforeUnmount(() => clearInterval(refreshTimer))
</script>
