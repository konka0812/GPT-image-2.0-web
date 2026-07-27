import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { describeTaskError, formatElapsed, submissionMessage, taskStatusUrl, taskStorageKey } from './task-feedback.js'

export function useImageTask(kind) {
  const job = ref(null)
  const images = ref([])
  const error = ref('')
  const notice = ref('')
  const submitting = ref(false)
  const now = ref(Date.now())
  let pollTimer
  let clockTimer
  let stopped = true

  const loading = computed(() => job.value?.status === 'running')
  const busy = computed(() => submitting.value || loading.value)
  const elapsed = computed(() => job.value ? formatElapsed((now.value - job.value.createdAt) / 1000) : '0秒')

  function stopPolling() {
    stopped = true
    clearInterval(pollTimer)
    clearInterval(clockTimer)
    pollTimer = undefined
    clockTimer = undefined
  }

  async function poll() {
    const activeId = job.value?.id
    if (!activeId || stopped) return
    try {
      const { data } = await axios.get(taskStatusUrl(activeId))
      if (stopped || job.value?.id !== activeId) return
      job.value = data
      images.value = data.images || []
      if (data.status !== 'running') {
        sessionStorage.removeItem(taskStorageKey(kind))
        if (data.status === 'failed') error.value = describeTaskError(data.error)
        stopPolling()
      }
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        sessionStorage.removeItem(taskStorageKey(kind))
        job.value = null
        stopPolling()
      } else {
        error.value = requestError.response?.data?.error || requestError.message
      }
    }
  }

  function schedulePoll() {
    if (stopped || job.value?.status !== 'running') return
    pollTimer = setTimeout(async () => {
      await poll()
      schedulePoll()
    }, 8000)
  }

  async function start(jobId) {
    const createdAt = Date.now()
    job.value = { id: jobId, status: 'running', phase: 'queued', progressText: '任务已提交，等待处理', createdAt, attempt: 0, maxAttempts: 0, pollCount: 0, baseUrl: '' }
    images.value = []
    error.value = ''
    notice.value = submissionMessage(jobId)
    sessionStorage.setItem(taskStorageKey(kind), jobId)
    stopPolling()
    stopped = false
    clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
    await poll()
    schedulePoll()
  }

  onMounted(() => {
    const jobId = sessionStorage.getItem(taskStorageKey(kind))
    if (jobId) void start(jobId)
  })
  onBeforeUnmount(stopPolling)

  return { job, images, error, notice, submitting, loading, busy, elapsed, start }
}
