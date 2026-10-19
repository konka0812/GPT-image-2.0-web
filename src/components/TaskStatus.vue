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
    <div v-if="signedLinks.length" class="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
      <p class="text-xs text-emerald-100">上游图片已生成，如果本地保存较慢，可直接打开：</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <a v-for="(link, index) in signedLinks" :key="link.url" :href="link.url" target="_blank" rel="noopener" class="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">打开图片{{ signedLinks.length > 1 ? index + 1 : '' }}</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { upstreamImageLinks } from '../task-feedback.js'

const props = defineProps({ job: { type: Object, required: true }, elapsed: { type: String, required: true }, queryCount: { type: Number, default: 0 }, title: { type: String, default: '任务处理中' } })
const phaseText = computed(() => ({ queued: '等待处理', calling: '调用上游', accepted: '上游已接收', polling: '查询上游任务', retry: '等待重试', saving: '保存图片' })[props.job.phase] || props.job.phase)
const signedLinks = computed(() => (props.job.upstreamLinks || []).filter((link) => link?.signed && link.url))
</script>
