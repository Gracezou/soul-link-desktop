import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import initSqlJs = require('sql.js')

import { ChatMessage, Session } from './types'

type MessageRole = 'user' | 'assistant' | 'system'

export class SessionStore {
  private readonly dbPath: string
  private db: initSqlJs.Database | null = null
  private initialized = false

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // resolve WASM relative to the sql.js module, works in both dev and packaged builds
    const sqlJsDir = path.dirname(require.resolve('sql.js'))
    const wasmPath = path.join(sqlJsDir, 'sql-wasm.wasm')
    const wasmBuffer = fs.readFileSync(wasmPath)
    const wasmBinary = wasmBuffer.buffer.slice(
      wasmBuffer.byteOffset,
      wasmBuffer.byteOffset + wasmBuffer.byteLength
    ) as ArrayBuffer
    const SQL = await initSqlJs({ wasmBinary })

    const dbData = fs.existsSync(this.dbPath) ? fs.readFileSync(this.dbPath) : null
    this.db = dbData ? new SQL.Database(dbData) : new SQL.Database()

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        character_name TEXT NOT NULL,
        created_at INTEGER,
        updated_at INTEGER
      );
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER,
        metadata TEXT
      );
    `)

    // Add summary column if it doesn't exist (migration for existing DBs)
    try {
      this.db.run(`ALTER TABLE sessions ADD COLUMN summary TEXT;`)
    } catch {
      // Column already exists — ignore
    }

    this.initialized = true
  }

  createSession(characterName: string): Session {
    const db = this.getDb()
    const now = Date.now()
    const session: Session = {
      id: crypto.randomUUID(),
      character_name: characterName,
      created_at: now,
      updated_at: now
    }

    db.run(
      `INSERT INTO sessions (id, character_name, created_at, updated_at)
       VALUES (?, ?, ?, ?);`,
      [session.id, session.character_name, session.created_at, session.updated_at]
    )
    this.saveToFile()

    return session
  }

  getCurrentSession(characterName: string): Session | null {
    const db = this.getDb()
    const statement = db.prepare(
      `SELECT id, character_name, created_at, updated_at
       FROM sessions
       WHERE character_name = ?
       ORDER BY updated_at DESC
       LIMIT 1;`,
      [characterName]
    )

    try {
      if (!statement.step()) {
        return null
      }

      const row = statement.getAsObject()
      return {
        id: String(row.id),
        character_name: String(row.character_name),
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at)
      }
    } finally {
      statement.free()
    }
  }

  getOrCreateSession(characterName: string): Session {
    const existing = this.getCurrentSession(characterName)
    if (existing) {
      return existing
    }

    return this.createSession(characterName)
  }

  saveMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>
  ): ChatMessage {
    const db = this.getDb()
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role,
      content,
      created_at: Date.now(),
      metadata
    }

    db.run(
      `INSERT INTO messages (id, session_id, role, content, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        message.id,
        message.session_id,
        message.role,
        message.content,
        message.created_at,
        metadata ? JSON.stringify(metadata) : null
      ]
    )

    db.run(
      `UPDATE sessions SET updated_at = ? WHERE id = ?;`,
      [message.created_at, sessionId]
    )

    this.saveToFile()
    return message
  }

  getMessages(sessionId: string, limit = 200): ChatMessage[] {
    const db = this.getDb()
    const safeLimit = Math.max(1, limit)
    const statement = db.prepare(
      `SELECT id, session_id, role, content, created_at, metadata
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT ?;`,
      [sessionId, safeLimit]
    )

    try {
      return this.readMessages(statement)
    } finally {
      statement.free()
    }
  }

  getRecentMessages(sessionId: string, count: number): ChatMessage[] {
    const db = this.getDb()
    const safeCount = Math.max(1, count)
    const statement = db.prepare(
      `SELECT id, session_id, role, content, created_at, metadata
       FROM (
         SELECT id, session_id, role, content, created_at, metadata
         FROM messages
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT ?
       ) recent
       ORDER BY created_at ASC;`,
      [sessionId, safeCount]
    )

    try {
      return this.readMessages(statement)
    } finally {
      statement.free()
    }
  }

  resetSession(characterName: string): Session {
    return this.createSession(characterName)
  }

  getDatabase(): initSqlJs.Database {
    return this.getDb()
  }

  getMessageCount(sessionId: string): number {
    const db = this.getDb()
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?', [sessionId])
    try {
      if (stmt.step()) {
        return Number(stmt.getAsObject().cnt)
      }
      return 0
    } finally {
      stmt.free()
    }
  }

  updateSessionSummary(sessionId: string, summary: string): void {
    const db = this.getDb()
    db.run('UPDATE sessions SET summary = ? WHERE id = ?', [summary, sessionId])
    this.saveToFile()
  }

  getSessionSummary(sessionId: string): string | null {
    const db = this.getDb()
    const stmt = db.prepare('SELECT summary FROM sessions WHERE id = ?', [sessionId])
    try {
      if (stmt.step()) {
        const val = stmt.getAsObject().summary
        return typeof val === 'string' ? val : null
      }
      return null
    } finally {
      stmt.free()
    }
  }

  close(): void {
    if (!this.db) {
      return
    }

    this.db.close()
    this.db = null
    this.initialized = false
  }

  private getDb(): initSqlJs.Database {
    if (!this.db || !this.initialized) {
      throw new Error('SessionStore is not initialized. Call initialize() first.')
    }

    return this.db
  }

  private readMessages(statement: initSqlJs.Statement): ChatMessage[] {
    const messages: ChatMessage[] = []

    while (statement.step()) {
      const row = statement.getAsObject()
      const metadata = this.parseMetadata(row.metadata)

      const message: ChatMessage = {
        id: String(row.id),
        session_id: String(row.session_id),
        role: String(row.role) as MessageRole,
        content: String(row.content),
        created_at: Number(row.created_at)
      }

      if (metadata !== undefined) {
        message.metadata = metadata
      }

      messages.push(message)
    }

    return messages
  }

  private parseMetadata(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== 'string' || value.length === 0) {
      return undefined
    }

    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  private saveToFile(): void {
    const db = this.getDb()
    const data = db.export()
    fs.writeFileSync(this.dbPath, Buffer.from(data))
  }
}
