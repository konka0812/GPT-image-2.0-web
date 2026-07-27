const jobs = new Map()
const maxJobs = 500

function trimJobs() {
  if (jobs.size <= maxJobs) return
  for (const [id, job] of jobs) {
    if (job.status !== 'running') jobs.delete(id)
    if (jobs.size <= maxJobs) break
  }
}

export function createJob({ userId, kind, recordId }) {
  const now = Date.now()
  const job = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    userId,
    kind,
    recordId,
    status: 'running',
    phase: 'queued',
    progressText: '任务已提交，等待处理',
    attempt: 0,
    maxAttempts: 0,
    pollCount: 0,
    baseUrl: '',
    images: [],
    error: '',
    createdAt: now,
    updatedAt: now,
    completedAt: null
  }
  jobs.set(job.id, job)
  trimJobs()
  return { ...job }
}

export function getJob(id, userId) {
  const job = jobs.get(id)
  return job && job.userId === userId ? { ...job, images: [...job.images] } : null
}

export function updateJob(id, fields) {
  const job = jobs.get(id)
  if (!job || job.status !== 'running') return null
  Object.assign(job, fields, { updatedAt: Date.now() })
  return { ...job, images: [...job.images] }
}

export function completeJob(id, images) {
  const job = jobs.get(id)
  if (!job) return null
  Object.assign(job, { status: 'success', phase: 'success', progressText: '处理成功', images: [...images], error: '', completedAt: Date.now(), updatedAt: Date.now() })
  return { ...job, images: [...job.images] }
}

export function failJob(id, error) {
  const job = jobs.get(id)
  if (!job) return null
  const message = error?.message || String(error)
  Object.assign(job, { status: 'failed', phase: 'failed', progressText: message, error: message, completedAt: Date.now(), updatedAt: Date.now() })
  return { ...job, images: [...job.images] }
}
