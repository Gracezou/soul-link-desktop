import path from 'path'
import fs from 'fs'
import os from 'os'
import initSqlJs from 'sql.js'
import { MemoryStore } from '../../electron/agent/memory-store'

// Helper: create an initialized MemoryStore backed by a real sql.js Database
async function createTestMemoryStore(dbPath: string) {
  const sqlJsDir = path.dirname(require.resolve('sql.js'))
  const wasmPath = path.join(sqlJsDir, 'sql-wasm.wasm')
  const wasmBuffer = fs.readFileSync(wasmPath)
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer
  const SQL = await initSqlJs({ wasmBinary })
  const db = new SQL.Database()

  const store = new MemoryStore({
    baseUrl: 'http://localhost',
    apiKey: 'test',
    model: 'test',
    dbPath,
  })
  store.initializeWithDb(db)

  return { store, db }
}

describe('MemoryStore', () => {
  let store: MemoryStore
  let db: initSqlJs.Database
  let dbPath: string

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `soul-link-test-memory-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    const result = await createTestMemoryStore(dbPath)
    store = result.store
    db = result.db
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  test('getMemoriesForPrompt returns empty string when no memories', () => {
    const prompt = store.getMemoriesForPrompt('baiyuan')
    expect(prompt).toBe('')
  })

  test('getAllMemories returns empty array when no memories', () => {
    const memories = store.getAllMemories('baiyuan')
    expect(memories).toEqual([])
  })

  test('upsert via SQL and retrieve', () => {
    // Since upsertMemory is private, insert directly via db for unit testing
    const now = Date.now()
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-001', 'baiyuan', 'user_info', '生日', '3月15日', now, now]
    )

    const memories = store.getAllMemories('baiyuan')
    expect(memories.length).toBe(1)
    expect(memories[0].key).toBe('生日')
    expect(memories[0].value).toBe('3月15日')
    expect(memories[0].category).toBe('user_info')
  })

  test('getMemoriesForPrompt formats correctly', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-001', 'baiyuan', 'user_info', '生日', '3月15日', now, now]
    )
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-002', 'baiyuan', 'preference', '爱好', '烘焙', now, now]
    )

    const prompt = store.getMemoriesForPrompt('baiyuan')
    expect(prompt).toContain('生日')
    expect(prompt).toContain('3月15日')
    expect(prompt).toContain('烘焙')
    expect(prompt).toContain('[用户记忆]')
  })

  test('memories are per-character', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-001', 'baiyuan', 'user_info', '生日', '3月15日', now, now]
    )

    const otherMemories = store.getAllMemories('other-character')
    expect(otherMemories.length).toBe(0)

    const baiyuanMemories = store.getAllMemories('baiyuan')
    expect(baiyuanMemories.length).toBe(1)
  })

  test('upsert updates existing memory (same character+category+key)', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)
       ON CONFLICT(character_id, category, key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ['mem-001', 'baiyuan', 'user_info', '生日', '3月15日', now, now]
    )
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)
       ON CONFLICT(character_id, category, key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ['mem-002', 'baiyuan', 'user_info', '生日', '3月20日', now + 1000, now + 1000]
    )

    const memories = store.getAllMemories('baiyuan')
    expect(memories.length).toBe(1)
    expect(memories[0].value).toBe('3月20日')
  })

  test('multiple categories are grouped in prompt', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-001', 'baiyuan', 'user_info', '名字', '小明', now, now]
    )
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-002', 'baiyuan', 'preference', '最爱', '咖啡', now, now]
    )
    db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)`,
      ['mem-003', 'baiyuan', 'event', '近况', '换了工作', now, now]
    )

    const prompt = store.getMemoriesForPrompt('baiyuan')
    expect(prompt).toContain('用户信息')
    expect(prompt).toContain('偏好')
    expect(prompt).toContain('近期事件')
  })
})
