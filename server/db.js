import dotenv from 'dotenv'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

dotenv.config()

const dbPath = process.env.APP_DB_PATH || 'data/app.json'
fsSync.mkdirSync(path.dirname(dbPath), { recursive: true })

const initial = {
  users: [],
  settings: [],
  generations: [],
  edits: [],
  seq: { users: 1, generations: 1, edits: 1 }
}

if (!fsSync.existsSync(dbPath)) fsSync.writeFileSync(dbPath, JSON.stringify(initial, null, 2))

let queue = Promise.resolve()

async function read() {
  return JSON.parse(await fs.readFile(dbPath, 'utf8'))
}

async function write(data) {
  const tmp = `${dbPath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, dbPath)
}

export async function withDb(fn) {
  const run = queue.then(async () => {
    const data = await read()
    const result = await fn(data)
    await write(data)
    return result
  })
  queue = run.catch(() => {})
  return run
}

export async function viewDb(fn) {
  const data = await read()
  return fn(data)
}
