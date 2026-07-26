import test from 'node:test'
import assert from 'node:assert/strict'
import { appendReferenceFiles, moveReferenceFile, removeReferenceFile } from '../src/reference-images.js'
import { buildReferencePayload, validateReferenceFiles } from '../server/reference.js'

const signatures = {
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff, 0xe0])
}
const file = (name, type = 'image/png') => ({ name, originalname: name, mimetype: type, buffer: Buffer.concat([signatures[type] || Buffer.from('not-an-image'), Buffer.from(name)]) })

test('appendReferenceFiles preserves order and limits the list to 16 images', () => {
  const current = [file('1.png')]
  const incoming = Array.from({ length: 20 }, (_, index) => file(`${index + 2}.png`))
  const result = appendReferenceFiles(current, incoming)
  assert.equal(result.length, 16)
  assert.deepEqual(result.map((item) => item.name), Array.from({ length: 16 }, (_, index) => `${index + 1}.png`))
})

test('moveReferenceFile and removeReferenceFile produce continuous displayed order', () => {
  const items = [file('1.png'), file('2.png'), file('3.png')]
  const moved = moveReferenceFile(items, 2, 0)
  assert.deepEqual(moved.map((item) => item.name), ['3.png', '1.png', '2.png'])
  assert.deepEqual(removeReferenceFile(moved, 1).map((item) => item.name), ['3.png', '2.png'])
})

test('validateReferenceFiles requires 1-16 image files', () => {
  assert.throws(() => validateReferenceFiles([]), /至少上传 1 张参考图/)
  assert.throws(() => validateReferenceFiles(Array.from({ length: 17 }, (_, index) => file(`${index}.png`))), /最多上传 16 张参考图/)
  assert.throws(() => validateReferenceFiles([file('notes.txt', 'text/plain')]), /只支持 PNG、JPEG 或 WebP 图片/)
  assert.throws(() => validateReferenceFiles([{ ...file('fake.png'), buffer: Buffer.from('not an image') }]), /只支持 PNG、JPEG 或 WebP 图片/)
})

test('buildReferencePayload preserves file order and always requests one image', () => {
  const files = [file('first.png'), file('second.jpg', 'image/jpeg')]
  const payload = buildReferencePayload({
    files,
    model: 'custom-image-model',
    prompt: 'Use Image 1 as background and Image 2 as product',
    size: '3840x2160',
    quality: 'high',
    outputFormat: 'png'
  })
  assert.equal(payload.model, 'custom-image-model')
  assert.equal(payload.n, 1)
  assert.match(payload.images[0].image_url, /^data:image\/png;base64,/)
  assert.match(payload.images[1].image_url, /^data:image\/jpeg;base64,/)
  assert.ok(Buffer.from(payload.images[0].image_url.split(',')[1], 'base64').subarray(-9).equals(Buffer.from('first.png')))
  assert.ok(Buffer.from(payload.images[1].image_url.split(',')[1], 'base64').subarray(-10).equals(Buffer.from('second.jpg')))
})

test('buildReferencePayload supports the 1 and 16 image boundaries', () => {
  for (const count of [1, 16]) {
    const files = Array.from({ length: count }, (_, index) => file(`${index + 1}.png`))
    const payload = buildReferencePayload({ files, model: 'gpt-image-2', prompt: 'compose', size: '1024x1024', quality: 'low', outputFormat: 'png' })
    assert.equal(payload.images.length, count)
    assert.equal(payload.n, 1)
    files.forEach((item, index) => assert.ok(payload.images[index].image_url.endsWith(item.buffer.toString('base64'))))
  }
})
