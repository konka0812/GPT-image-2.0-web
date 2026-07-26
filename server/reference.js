export const maxReferenceImages = 16
export const maxReferenceImageBytes = 4 * 1024 * 1024

function isSupportedImage(file) {
  const bytes = file.buffer
  if (!bytes?.length) return false
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  return isPng || isJpeg || isWebp
}

export function validateReferenceFiles(files) {
  if (!files.length) throw new Error('请至少上传 1 张参考图')
  if (files.length > maxReferenceImages) throw new Error('最多上传 16 张参考图')
  if (files.some((file) => !file.mimetype?.startsWith('image/') || !isSupportedImage(file))) throw new Error('只支持 PNG、JPEG 或 WebP 图片')
}

export function buildReferencePayload({ files, model, prompt, size, quality, outputFormat }) {
  validateReferenceFiles(files)
  return {
    model,
    prompt,
    images: files.map((file) => ({ image_url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}` })),
    size,
    quality,
    output_format: outputFormat,
    n: 1
  }
}
