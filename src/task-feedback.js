export function formatElapsed(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0))
  if (value < 60) return `${value}秒`
  return `${Math.floor(value / 60)}分${String(value % 60).padStart(2, '0')}秒`
}

export function describeTaskError(error = '') {
  if (error.includes('401')) return '上游认证被拒绝（HTTP 401），请检查服务商与 API Key；如同一 Key 偶发成功，可稍后重试'
  if (error.includes('403')) return '上游因权限或内容策略拒绝请求（HTTP 403）'
  if (error.includes('413')) return '上传图片超过大小限制'
  if (error.includes('502')) return '上游服务暂时不可用，请稍后重试'
  if (/524|timeout|超时|aborted/i.test(error)) return '上游处理超时，建议降低尺寸或质量后重试'
  if (/fetch failed|连接/i.test(error)) return '连接上游失败，请稍后重试'
  return error || '任务处理失败'
}

export function submissionMessage(jobId) {
  return `任务已提交（${jobId}），请勿重复点击`
}

export function taskStatusUrl(jobId) {
  return `/api/images/tasks/${jobId}`
}

export function taskStorageKey(kind) {
  return `active-image-task:${kind}`
}
