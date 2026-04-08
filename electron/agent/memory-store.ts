import crypto from 'crypto'
import fs from 'fs'
import type initSqlJs from 'sql.js'
import { LlmClient } from './llm-client'
import type { AgentConfig } from './types'

export interface Memory {
  id: string
  character_id: string
  category: string
  key: string
  value: string
  confidence: number
  created_at: number
  updated_at: number
}

const CATEGORY_LABELS: Record<string, string> = {
  user_info: '用户信息',
  preference: '偏好',
  event: '近期事件',
  relationship: '人际关系',
  mood: '情绪状态',
}

export class MemoryStore {
  private db: initSqlJs.Database | null = null
  private readonly dbPath: string
  private readonly llmClient: LlmClient

  constructor(config: Pick<AgentConfig, 'baseUrl' | 'apiKey' | 'model' | 'dbPath'>) {
    this.dbPath = config.dbPath
    this.llmClient = new LlmClient(config)
  }

  initializeWithDb(db: initSqlJs.Database): void {
    this.db = db
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(character_id, category, key)
      );
    `)
  }

  getMemoriesForPrompt(characterId: string): string {
    if (!this.db) return ''
    const stmt = this.db.prepare(
      'SELECT category, key, value FROM memories WHERE character_id = ? ORDER BY category, updated_at DESC',
      [characterId]
    )

    const groups: Record<string, string[]> = {}
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject()
        const cat = String(row.category)
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(`${row.key}: ${row.value}`)
      }
    } finally {
      stmt.free()
    }

    if (Object.keys(groups).length === 0) return ''

    let result = '[用户记忆]\n'
    for (const [cat, items] of Object.entries(groups)) {
      result += `【${CATEGORY_LABELS[cat] || cat}】${items.join('、')}\n`
    }
    return result.trim()
  }

  async extractAndSave(characterId: string, userMessage: string, assistantMessage: string): Promise<void> {
    const shouldExtract = /我|我的|my|mine/i.test(userMessage) || userMessage.length > 20
    if (!shouldExtract) return

    const extractionPrompt = `从以下对话中提取用户的个人信息。返回JSON数组，每项包含 category, key, value 字段。
category 可选值: user_info, preference, event, relationship, mood
如果没有可提取的信息，返回空数组 []。

用户: ${userMessage}
角色: ${assistantMessage}

只返回JSON数组，不要其他文字。`

    try {
      const result = await this.llmClient.chatCompletion(
        [
          { role: 'system', content: '你是信息提取工具。只返回JSON数组。' },
          { role: 'user', content: extractionPrompt }
        ],
        { temperature: 0.1, max_tokens: 300 }
      )

      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return

      const facts = JSON.parse(jsonMatch[0]) as Array<{ category: string; key: string; value: string }>
      if (!Array.isArray(facts)) return

      for (const fact of facts) {
        if (!fact.category || !fact.key || !fact.value) continue
        this.upsertMemory(characterId, fact.category, fact.key, fact.value)
      }
    } catch {
      // Silent fail — memory extraction is best-effort
    }
  }

  getAllMemories(characterId: string): Memory[] {
    if (!this.db) return []
    const stmt = this.db.prepare(
      'SELECT * FROM memories WHERE character_id = ? ORDER BY updated_at DESC',
      [characterId]
    )
    const memories: Memory[] = []
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject()
        memories.push({
          id: String(row.id),
          character_id: String(row.character_id),
          category: String(row.category),
          key: String(row.key),
          value: String(row.value),
          confidence: Number(row.confidence),
          created_at: Number(row.created_at),
          updated_at: Number(row.updated_at),
        })
      }
    } finally {
      stmt.free()
    }
    return memories
  }

  private upsertMemory(characterId: string, category: string, key: string, value: string): void {
    if (!this.db) return
    const now = Date.now()

    this.db.run(
      `INSERT INTO memories (id, character_id, category, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1.0, ?, ?)
       ON CONFLICT(character_id, category, key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [crypto.randomUUID(), characterId, category, key, value, now, now]
    )

    const data = this.db.export()
    fs.writeFileSync(this.dbPath, Buffer.from(data))
  }
}
