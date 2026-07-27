import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { viewDb, withDb } from './db.js'
import { requireAuth, signToken } from './auth.js'
import { completeJob, createJob, failJob, getJob, updateJob } from './jobs.js'
import { buildReferencePayload, maxReferenceImageBytes, validateReferenceFiles } from './reference.js'
import { defaultModel, normalizeModel, requireModel } from './settings.js'
import { assertEnum, callImageApiWithRetry, formats, qualities, saveImage, sizes } from './utils.js'

const batchConcurrency = 1
const defaultBaseUrl = 'https://testvideo.site/v1'
const fallbackBaseUrl = process.env.FALLBACK_BASE_URL || 'https://hk.testvideo.site/v1'
const batchJobs = new Map()

function chunkError(error) {
  return error?.message || '处理失败'
}

dotenv.config()

const app = express()
const upload = multer({ limits: { fileSize: 30 * 1024 * 1024 } })
const referenceUpload = multer({ limits: { fileSize: maxReferenceImageBytes, files: 16 } })
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function uploadReferenceImages(req, res, next) {
  referenceUpload.array('files', 16)(req, res, (error) => {
    if (error?.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: '最多上传 16 张参考图' })
    if (error?.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: '最多上传 16 张参考图' })
    if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '每张参考图不能超过 4MB' })
    if (error) return next(error)
    next()
  })
}

app.use(cors())
app.use(express.json({ limit: '60mb' }))
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(rootDir, 'uploads')))

await withDb((data) => {
  for (const record of [...data.generations, ...data.edits]) {
    if (record.status === 'running') Object.assign(record, { status: 'interrupted', phase: 'interrupted', progress_text: '服务曾重启，任务状态无法继续跟踪，请重新提交', completed_at: new Date().toISOString() })
  }
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    if (username.length < 3 || password.length < 6) return res.status(400).json({ error: '用户名至少3位，密码至少6位' })
    const token = await withDb(async (data) => {
      if (data.users.some((u) => u.username === username)) throw new Error('用户名已存在')
      const user = { id: data.seq.users++, username, password_hash: await bcrypt.hash(password, 10), created_at: new Date().toISOString() }
      data.users.push(user)
      return signToken(user)
    })
    res.json({ token })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')
  const user = await viewDb((data) => data.users.find((u) => u.username === username))
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: '用户名或密码错误' })
  res.json({ token: signToken(user) })
})

app.get('/api/settings', requireAuth, async (req, res) => {
  const row = await viewDb((data) => data.settings.find((s) => s.user_id === req.user.id))
  res.json(row
    ? { base_url: row.base_url, api_key: row.api_key, model: normalizeModel(row.model) }
    : { base_url: defaultBaseUrl, api_key: '', model: defaultModel })
})

app.post('/api/settings', requireAuth, async (req, res) => {
  const baseUrl = String(req.body.base_url || defaultBaseUrl).trim()
  const apiKey = String(req.body.api_key || '').trim()
  let model
  try {
    model = requireModel(req.body.model)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  if (!apiKey) return res.status(400).json({ error: '请填写 API Key' })
  await withDb((data) => {
    const old = data.settings.find((s) => s.user_id === req.user.id)
    if (old) Object.assign(old, { base_url: baseUrl, api_key: apiKey, model, updated_at: new Date().toISOString() })
    else data.settings.push({ user_id: req.user.id, base_url: baseUrl, api_key: apiKey, model, updated_at: new Date().toISOString() })
  })
  res.json({ ok: true })
})

async function getSettings(userId) {
  const row = await viewDb((data) => data.settings.find((s) => s.user_id === userId))
  if (!row?.api_key) throw new Error('请先在设置页填写 API Key')
  return { ...row, base_url: row.base_url || defaultBaseUrl, model: normalizeModel(row.model) }
}

async function callWithFallback(settings, endpoint, payload, onStatus = () => {}) {
  try {
    return await callImageApiWithRetry({ baseUrl: settings.base_url || defaultBaseUrl, apiKey: settings.api_key, endpoint, payload }, 2, onStatus)
  } catch (error) {
    if ((settings.base_url || defaultBaseUrl) === fallbackBaseUrl) throw error
    onStatus({ type: 'fallback', from: settings.base_url || defaultBaseUrl, to: fallbackBaseUrl, error: error.message })
    return await callImageApiWithRetry({ baseUrl: fallbackBaseUrl, apiKey: settings.api_key, endpoint, payload }, 2, onStatus)
  }
}

function historyRecord(data, kind, recordId) {
  const records = kind === 'generate' ? data.generations : data.edits
  return records.find((record) => record.id === recordId)
}

async function updateJobHistory(job, fields) {
  await withDb((data) => {
    const record = historyRecord(data, job.kind, job.recordId)
    if (record) Object.assign(record, fields)
  })
}

function reportJobStatus(job, status) {
  let fields = {}
  if (status.type === 'attempt') fields = { phase: 'calling', progressText: `正在调用 ${status.baseUrl}，第 ${status.attempt}/${status.max} 次`, attempt: status.attempt, maxAttempts: status.max, baseUrl: status.baseUrl }
  if (status.type === 'retry') fields = { phase: 'retry', progressText: `调用失败，等待后进行第 ${status.nextAttempt}/${status.max} 次尝试`, attempt: status.attempt, maxAttempts: status.max, baseUrl: status.baseUrl }
  if (status.type === 'fallback') fields = { phase: 'fallback', progressText: `主线路失败，切换备用线路 ${status.to}`, baseUrl: status.to }
  if (status.type === 'accepted') fields = { phase: 'accepted', progressText: '上游已接受任务，等待处理', baseUrl: status.baseUrl }
  if (status.type === 'poll') fields = { phase: 'polling', progressText: `正在第 ${status.pollCount} 次查询上游任务`, pollCount: status.pollCount, baseUrl: status.baseUrl }
  if (status.type === 'poll-result') fields = { phase: 'polling', progressText: `第 ${status.pollCount} 次查询：${status.status}`, pollCount: status.pollCount, baseUrl: status.baseUrl }
  if (!Object.keys(fields).length) return
  updateJob(job.id, fields)
  void updateJobHistory(job, { phase: fields.phase, progress_text: fields.progressText, attempt: fields.attempt, poll_count: fields.pollCount, base_url: fields.baseUrl }).catch(() => {})
}

async function finishImageJob(job, settings, endpoint, payload, outputFormat, maxImages = Infinity) {
  try {
    const result = await callWithFallback(settings, endpoint, payload, (status) => reportJobStatus(job, status))
    updateJob(job.id, { phase: 'saving', progressText: '上游处理完成，正在保存图片' })
    await updateJobHistory(job, { phase: 'saving', progress_text: '上游处理完成，正在保存图片' }).catch(() => {})
    const images = []
    for (const item of (result.data || []).slice(0, maxImages)) images.push(await saveImage(item, outputFormat))
    if (!images.length) throw new Error('上游未返回生成图片')
    completeJob(job.id, images)
    await updateJobHistory(job, { image_path: JSON.stringify(images), status: 'success', phase: 'success', progress_text: '处理成功', completed_at: new Date().toISOString() }).catch(() => {})
  } catch (error) {
    failJob(job.id, error)
    await updateJobHistory(job, { status: 'failed', phase: 'failed', progress_text: error.message, error: error.message, completed_at: new Date().toISOString() }).catch(() => {})
  }
}

app.get('/api/images/tasks/:jobId', requireAuth, (req, res) => {
  const job = getJob(req.params.jobId, req.user.id)
  if (!job) return res.status(404).json({ error: '任务不存在或无权访问' })
  res.json(job)
})

app.post('/api/images/generate', requireAuth, async (req, res) => {
  const prompt = String(req.body.prompt || '').trim()
  const size = assertEnum(req.body.size, sizes, '1024x1024')
  const quality = assertEnum(req.body.quality, qualities, 'low')
  const outputFormat = assertEnum(req.body.output_format, formats, 'png')
  const n = Math.min(4, Math.max(1, Number(req.body.n || 1)))
  if (!prompt) return res.status(400).json({ error: '请输入提示词' })
  let recordId
  try {
    const settings = await getSettings(req.user.id)
    recordId = await withDb((data) => {
      const record = { id: data.seq.generations++, user_id: req.user.id, prompt, size, quality, output_format: outputFormat, image_path: '', status: 'running', error: '', created_at: new Date().toISOString() }
      data.generations.push(record)
      return record.id
    })
    const job = createJob({ userId: req.user.id, kind: 'generate', recordId })
    await updateJobHistory(job, { job_id: job.id, phase: job.phase, progress_text: job.progressText, started_at: new Date(job.createdAt).toISOString() })
    res.status(202).json({ jobId: job.id })
    void finishImageJob(job, settings, '/images/generations', { model: settings.model, prompt, size, quality, output_format: outputFormat, n }, outputFormat).catch((error) => failJob(job.id, error))
  } catch (error) {
    if (recordId) await withDb((data) => Object.assign(data.generations.find((r) => r.id === recordId), { status: 'failed', error: error.message }))
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/images/edit', requireAuth, upload.single('file'), async (req, res) => {
  const prompt = String(req.body.prompt || '').trim()
  const size = assertEnum(req.body.size, sizes, '1024x1024')
  const quality = assertEnum(req.body.quality, qualities, 'low')
  const outputFormat = assertEnum(req.body.output_format, formats, 'png')
  if (!req.file) return res.status(400).json({ error: '请上传图片文件' })
  const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  if (!prompt) return res.status(400).json({ error: '请输入编辑提示词' })
  let recordId
  try {
    const settings = await getSettings(req.user.id)
    recordId = await withDb((data) => {
      const record = { id: data.seq.edits++, user_id: req.user.id, prompt, size, quality, output_format: outputFormat, source_image: imageUrl.slice(0, 500), image_path: '', status: 'running', error: '', created_at: new Date().toISOString() }
      data.edits.push(record)
      return record.id
    })
    const job = createJob({ userId: req.user.id, kind: 'edit', recordId })
    await updateJobHistory(job, { job_id: job.id, phase: job.phase, progress_text: job.progressText, started_at: new Date(job.createdAt).toISOString() })
    res.status(202).json({ jobId: job.id })
    void finishImageJob(job, settings, '/images/edits', { model: settings.model, prompt, images: [{ image_url: imageUrl }], size, quality }, outputFormat).catch((error) => failJob(job.id, error))
  } catch (error) {
    if (recordId) await withDb((data) => {
      const record = data.edits.find((r) => r.id === recordId)
      if (record) Object.assign(record, { status: 'failed', error: error.message })
    })
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/images/reference', requireAuth, uploadReferenceImages, async (req, res) => {
  const prompt = String(req.body.prompt || '').trim()
  const size = assertEnum(req.body.size, sizes, '1024x1024')
  const quality = assertEnum(req.body.quality, qualities, 'low')
  const outputFormat = assertEnum(req.body.output_format, formats, 'png')
  const files = req.files || []
  if (!prompt) return res.status(400).json({ error: '请输入提示词' })
  try {
    validateReferenceFiles(files)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  let recordId
  try {
    const settings = await getSettings(req.user.id)
    const payload = buildReferencePayload({ files, model: settings.model, prompt, size, quality, outputFormat })
    recordId = await withDb((data) => {
      const record = { id: data.seq.edits++, user_id: req.user.id, prompt, size, quality, output_format: outputFormat, source_image: JSON.stringify(files.map((file) => file.originalname)), image_path: '', status: 'running', error: '', created_at: new Date().toISOString(), type: 'reference' }
      data.edits.push(record)
      return record.id
    })
    const job = createJob({ userId: req.user.id, kind: 'reference', recordId })
    await updateJobHistory(job, { job_id: job.id, phase: job.phase, progress_text: job.progressText, started_at: new Date(job.createdAt).toISOString() })
    res.status(202).json({ jobId: job.id })
    void finishImageJob(job, settings, '/images/edits', payload, outputFormat, 1).catch((error) => failJob(job.id, error))
  } catch (error) {
    if (recordId) await withDb((data) => {
      const record = data.edits.find((entry) => entry.id === recordId)
      if (record) Object.assign(record, { status: 'failed', error: error.message })
    })
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/images/edit/batch', requireAuth, upload.array('files', 20), async (req, res) => {
  const prompt = String(req.body.prompt || '').trim()
  const size = assertEnum(req.body.size, sizes, '1024x1024')
  const quality = assertEnum(req.body.quality, qualities, 'low')
  const outputFormat = assertEnum(req.body.output_format, formats, 'png')
  const files = req.files || []
  if (!prompt) return res.status(400).json({ error: '请输入编辑提示词' })
  if (!files.length) return res.status(400).json({ error: '请上传图片文件' })
  try {
    const settings = await getSettings(req.user.id)
    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const job = {
      id: jobId,
      userId: req.user.id,
      total: files.length,
      completed: 0,
      running: 0,
      status: 'running',
      results: files.map((file, index) => ({ index, name: file.originalname, status: 'queued', progressText: '排队中', images: [] })),
      queryCount: 0,
      createdAt: Date.now()
    }
    batchJobs.set(jobId, job)
    res.json({ jobId })

    let cursor = 0
    async function worker() {
      while (cursor < files.length) {
        const index = cursor++
        const file = files[index]
        job.running += 1
        job.results[index] = { index, name: file.originalname, status: 'running', progressText: '准备调用上游', images: [] }
        const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
        let recordId
        try {
          recordId = await withDb((data) => {
            const record = { id: data.seq.edits++, user_id: req.user.id, prompt, size, quality, output_format: outputFormat, source_image: file.originalname, image_path: '', status: 'running', error: '', created_at: new Date().toISOString(), job_id: jobId, phase: 'queued', progress_text: '排队中', started_at: new Date().toISOString() }
            data.edits.push(record)
            return record.id
          })
          const data = await callWithFallback(settings, '/images/edits', { model: settings.model, prompt, images: [{ image_url: imageUrl }], size, quality }, (status) => {
            if (status.type === 'attempt') job.results[index].progressText = `调用 ${status.baseUrl}，第 ${status.attempt}/${status.max} 次`
            if (status.type === 'retry') job.results[index].progressText = `${status.baseUrl} 超时/失败，8秒后重试第 ${status.nextAttempt}/${status.max} 次`
            if (status.type === 'fallback') job.results[index].progressText = `主线路失败，切换备用线路 ${status.to}`
            if (status.type === 'poll') job.results[index].progressText = `正在第 ${status.pollCount} 次查询上游任务`
            if (status.type === 'poll-result') job.results[index].progressText = `第 ${status.pollCount} 次查询：${status.status}`
            const progress = job.results[index].progressText
            void withDb((data) => {
              const record = data.edits.find((entry) => entry.id === recordId)
              if (record) Object.assign(record, { phase: status.type, progress_text: progress, attempt: status.attempt, poll_count: status.pollCount, base_url: status.baseUrl })
            }).catch(() => {})
          })
          const images = []
          for (const item of data.data || []) images.push(await saveImage(item, outputFormat))
          await withDb((data) => Object.assign(data.edits.find((r) => r.id === recordId), { image_path: JSON.stringify(images), status: 'success', phase: 'success', progress_text: '处理成功', completed_at: new Date().toISOString() }))
          job.results[index] = { index, name: file.originalname, status: 'success', progressText: '处理成功', images }
        } catch (error) {
          if (recordId) await withDb((data) => Object.assign(data.edits.find((r) => r.id === recordId), { status: 'failed', phase: 'failed', progress_text: chunkError(error), error: chunkError(error), completed_at: new Date().toISOString() }))
          job.results[index] = { index, name: file.originalname, status: 'failed', progressText: chunkError(error), error: chunkError(error), images: [] }
        } finally {
          job.running -= 1
          job.completed += 1
        }
      }
    }
    Promise.all(Array.from({ length: Math.min(batchConcurrency, files.length) }, () => worker())).then(() => {
      job.status = 'completed'
      job.completedAt = Date.now()
    }).catch((error) => {
      job.status = 'failed'
      job.error = chunkError(error)
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/images/edit/batch/:jobId', requireAuth, (req, res) => {
  const job = batchJobs.get(req.params.jobId)
  if (!job || job.userId !== req.user.id) return res.status(404).json({ error: '任务不存在' })
  job.queryCount += 1
  res.json(job)
})

app.get('/api/history', requireAuth, async (req, res) => {
  const history = await viewDb((data) => ({
    generations: data.generations.filter((r) => r.user_id === req.user.id).sort((a, b) => b.id - a.id).slice(0, 100),
    edits: data.edits.filter((r) => r.user_id === req.user.id).sort((a, b) => b.id - a.id).slice(0, 100)
  }))
  res.json(history)
})

app.delete('/api/history', requireAuth, async (req, res) => {
  await withDb((data) => {
    data.generations = data.generations.filter((r) => r.user_id !== req.user.id)
    data.edits = data.edits.filter((r) => r.user_id !== req.user.id)
  })
  res.json({ ok: true })
})

app.use(express.static(path.join(rootDir, 'dist')))
app.get(/.*/, (req, res) => res.sendFile(path.join(rootDir, 'dist', 'index.html')))

app.listen(Number(process.env.PORT || 3003), () => console.log(`listening on ${process.env.PORT || 3003}`))
