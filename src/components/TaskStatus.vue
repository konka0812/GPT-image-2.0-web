<template>
  <div class="w-full max-w-lg space-y-4 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6 text-left">
    <div class="flex items-center justify-between gap-4">
      <strong class="text-cyan-100">{{ title }}</strong>
      <span class="text-xs text-cyan-200">已等待 {{ elapsed }}</span>
    </div>
    <p class="text-sm text-slate-200">{{ job.progressText }}</p>
    <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-400">
      <dt>任务编号</dt><dd class="truncate text-right text-slate-300" :title="job.id">{{ job.id }}</dd>
      <dt>当前阶段</dt><dd class="text-right text-slate-300">{{ phaseText }}</dd>
      <dt>调用尝试</dt><dd class="text-right text-slate-300">{{ job.attempt || 0 }} / {{ job.maxAttempts || '-' }}</dd>
      <dt>页面状态查询</dt><dd class="text-right text-slate-300">{{ queryCount }} 次</dd>
      <template v-if="job.pollCount"><dt>上游任务查询</dt><dd class="text-right text-slate-300">{{ job.pollCount }} 次</dd></template>
      <template v-else><dt>上游响应方式</dt><dd class="text-right text-slate-300">同步等待响应</dd></template>
      <template v-if="job.baseUrl"><dt>当前线路</dt><dd class="truncate text-right text-slate-300" :title="job.baseUrl">{{ job.baseUrl }}</dd></template>
    </dl>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ job: { type: Object, required: true }, elapsed: { type: String, required: true }, queryCount: { type: Number, default: 0 }, title: { type: String, default: '任务处理中' } })
const phaseText = computed(() => ({ queued: '等待处理', calling: '调用上游', accepted: '上游已接收', polling: '查询上游任务', retry: '等待重试', fallback: '切换备用线路', saving: '保存图片' })[props.job.phase] || props.job.phase)
</script>
