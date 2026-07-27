<template>
  <article class="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-center gap-2">
          <span class="rounded-full px-2 py-1 text-[11px] font-bold" :class="statusClass">{{ statusText }}</span>
          <span class="truncate text-sm font-semibold text-slate-100">{{ item.prompt || '无提示词' }}</span>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>{{ item.size }}</span><span>{{ item.quality }}</span><span>{{ item.output_format }}</span><span>{{ createdAt }}</span><span v-if="duration">耗时 {{ duration }}</span>
        </div>
        <p v-if="item.status === 'running'" class="text-xs text-cyan-200">{{ item.progress_text || '任务处理中' }}<span v-if="item.poll_count"> · 第 {{ item.poll_count }} 次查询</span></p>
        <p v-if="item.error" class="text-xs text-red-300">{{ readableError }}</p>
      </div>
      <div v-if="images.length" class="flex shrink-0 gap-2">
        <button class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cyan-200" @click="$emit('preview', images)">预览</button>
        <a :href="images[0]" download class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cyan-200">下载</a>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { describeTaskError, formatElapsed } from '../task-feedback.js'

const props = defineProps({ item: { type: Object, required: true } })
defineEmits(['preview'])
const images = computed(() => {
  try {
    return JSON.parse(props.item.image_path || '[]')
  } catch {
    return []
  }
})
const statusText = computed(() => ({ running: '处理中', success: '成功', failed: '失败', interrupted: '已中断' })[props.item.status] || props.item.status)
const statusClass = computed(() => props.item.status === 'success' ? 'bg-emerald-500/15 text-emerald-300' : props.item.status === 'running' ? 'bg-cyan-500/15 text-cyan-200' : 'bg-red-500/15 text-red-300')
const createdAt = computed(() => new Date(props.item.created_at).toLocaleString('zh-CN'))
const duration = computed(() => {
  if (!props.item.started_at && !props.item.completed_at) return ''
  const start = new Date(props.item.started_at || props.item.created_at).getTime()
  const end = new Date(props.item.completed_at || Date.now()).getTime()
  return formatElapsed((end - start) / 1000)
})
const readableError = computed(() => describeTaskError(props.item.error))
</script>
