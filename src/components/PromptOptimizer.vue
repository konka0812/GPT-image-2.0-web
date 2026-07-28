<template>
  <button
    type="button"
    class="absolute right-2 top-2 z-10 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-amber-300 hover:bg-black/60"
    :disabled="optimizing"
    @click="optimize"
    title="优化提示词"
  >{{ optimizing ? '...' : '💡' }}</button>
  <div v-if="optimizing" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.stop>
    <div class="rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400"></div>
      <p class="text-sm text-slate-200">正在优化提示词，请稍候...</p>
    </div>
  </div>
  <div v-if="showResult" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" @click="showResult = false">
    <div class="flex max-h-[85vh] w-full max-w-4xl flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-8" @click.stop>
      <h3 class="text-lg font-bold text-slate-100">优化结果</h3>
      <textarea v-model="optimized" class="field min-h-[400px] flex-1 resize-none text-sm leading-7"></textarea>
      <div class="flex justify-end gap-3">
        <button class="btn border border-white/10" @click="showResult = false">取消</button>
        <button class="btn btn-primary" @click="adopt">采用</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'

const props = defineProps({ modelValue: { type: String, default: '' }, type: { type: String, default: 'generate' } })
const emit = defineEmits(['update:modelValue'])

const optimizing = ref(false)
const showResult = ref(false)
const optimized = ref('')

async function optimize() {
  if (!props.modelValue.trim()) return
  optimizing.value = true
  try {
    const { data } = await axios.post('/api/optimize-prompt', { prompt: props.modelValue, type: props.type })
    optimized.value = data.optimized
    showResult.value = true
  } catch (e) {
    alert(e.response?.data?.error || e.message)
  } finally {
    optimizing.value = false
  }
}

function adopt() {
  emit('update:modelValue', optimized.value)
  showResult.value = false
}
</script>
