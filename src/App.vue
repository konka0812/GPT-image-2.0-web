<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <nav v-if="isAuthed" class="mx-auto flex h-20 w-full max-w-[1800px] shrink-0 items-center justify-between px-6">
      <router-link to="/generate" class="text-xl font-black tracking-tight">Image Studio</router-link>
      <div class="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
        <router-link v-for="item in items" :key="item.path" :to="item.path" class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300" active-class="bg-white/15 text-white">{{ item.label }}</router-link>
      </div>
      <button class="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300" @click="logout">退出</button>
    </nav>
    <main class="mx-auto min-h-0 w-full max-w-[1800px] flex-1 px-6 pb-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const items = [
  { path: '/generate', label: '生图' },
  { path: '/edit', label: '改图' },
  { path: '/reference', label: '参考图生成' },
  { path: '/batch-edit', label: '批量改图' },
  { path: '/history', label: '历史' },
  { path: '/settings', label: '设置' }
]
const isAuthed = computed(() => router.currentRoute.value.path !== '/login')
const logout = () => {
  localStorage.removeItem('token')
  router.push('/login')
}
</script>
