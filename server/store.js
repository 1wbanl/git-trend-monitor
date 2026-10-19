import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildSeedState } from './seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'server', 'data')
const STATE_FILE = path.join(DATA_DIR, 'state.json')

let state = null
let writeQueue = Promise.resolve()

function ensureDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function persistSync() {
  ensureDirectory()
  state.meta.updatedAt = new Date().toISOString()
  const tempFile = `${STATE_FILE}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(tempFile, STATE_FILE)
}

export function initStore() {
  ensureDirectory()
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
      if (!state.projects || !state.meta) throw new Error('Invalid state shape')
      return state
    } catch (error) {
      const backup = `${STATE_FILE}.corrupt-${Date.now()}`
      fs.copyFileSync(STATE_FILE, backup)
      console.warn(`[store] state.json 无法读取，已备份至 ${backup}，使用初始数据重建。`)
    }
  }
  state = buildSeedState()
  persistSync()
  return state
}

export function getState() {
  if (!state) initStore()
  return state
}

export function saveState() {
  const snapshot = JSON.parse(JSON.stringify(state))
  writeQueue = writeQueue.then(async () => {
    ensureDirectory()
    snapshot.meta.updatedAt = new Date().toISOString()
    const tempFile = `${STATE_FILE}.tmp`
    await fs.promises.writeFile(tempFile, JSON.stringify(snapshot, null, 2), 'utf8')
    await fs.promises.rename(tempFile, STATE_FILE)
  })
  return writeQueue
}

export function addSyncLog(entry) {
  const db = getState()
  const log = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    status: 'success',
    source: 'github',
    added: 0,
    updated: 0,
    duration: 0,
    ...entry
  }
  db.syncLogs.unshift(log)
  db.syncLogs = db.syncLogs.slice(0, 25)
  return log
}

export function addActivity(entry) {
  const db = getState()
  const item = {
    id: crypto.randomUUID(),
    type: 'sync',
    createdAt: new Date().toISOString(),
    ...entry
  }
  db.activity.unshift(item)
  db.activity = db.activity.slice(0, 30)
  return item
}

export function addAlertEvent(entry) {
  const db = getState()
  const item = {
    id: crypto.randomUUID(),
    read: false,
    severity: 'medium',
    createdAt: new Date().toISOString(),
    ...entry
  }
  db.alerts.events.unshift(item)
  db.alerts.events = db.alerts.events.slice(0, 50)
  return item
}

export function getMeta() {
  return getState().meta
}

export const paths = { ROOT, DATA_DIR, STATE_FILE }
