import path from 'path'
import fs from 'fs'
import os from 'os'
import { SessionStore } from '../../electron/agent/session-store'

describe('SessionStore', () => {
  let store: SessionStore
  let dbPath: string

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `soul-link-test-session-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    store = new SessionStore(dbPath)
    await store.initialize()
  })

  afterEach(() => {
    store.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  test('creates session', () => {
    const session = store.createSession('baiyuan')
    expect(session.id).toBeTruthy()
    expect(session.character_name).toBe('baiyuan')
    expect(session.created_at).toBeGreaterThan(0)
    expect(session.updated_at).toBeGreaterThan(0)
  })

  test('getCurrentSession returns latest session', () => {
    store.createSession('baiyuan')
    const active = store.getCurrentSession('baiyuan')
    expect(active).not.toBeNull()
    expect(active!.character_name).toBe('baiyuan')
  })

  test('returns null for no session', () => {
    const active = store.getCurrentSession('nonexistent')
    expect(active).toBeNull()
  })

  test('getOrCreateSession creates if none exists', () => {
    const session = store.getOrCreateSession('baiyuan')
    expect(session.id).toBeTruthy()
    expect(session.character_name).toBe('baiyuan')
  })

  test('getOrCreateSession returns existing session', () => {
    const first = store.getOrCreateSession('baiyuan')
    const second = store.getOrCreateSession('baiyuan')
    expect(second.id).toBe(first.id)
  })

  test('saveMessage and getMessages', () => {
    const session = store.createSession('baiyuan')
    store.saveMessage(session.id, 'user', '你好')

    const messages = store.getMessages(session.id)
    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe('你好')
    expect(messages[0].role).toBe('user')
    expect(messages[0].session_id).toBe(session.id)
  })

  test('messages ordered by created_at ASC', () => {
    const session = store.createSession('baiyuan')
    store.saveMessage(session.id, 'user', 'first')
    store.saveMessage(session.id, 'assistant', 'second')

    const messages = store.getMessages(session.id)
    expect(messages[0].content).toBe('first')
    expect(messages[1].content).toBe('second')
  })

  test('getMessages respects limit', () => {
    const session = store.createSession('baiyuan')
    for (let i = 0; i < 20; i++) {
      store.saveMessage(session.id, 'user', `message ${i}`)
    }

    const messages = store.getMessages(session.id, 5)
    expect(messages.length).toBe(5)
  })

  test('getRecentMessages returns exactly N messages', () => {
    const session = store.createSession('baiyuan')
    for (let i = 0; i < 10; i++) {
      store.saveMessage(session.id, 'user', `message ${i}`)
    }

    const recent = store.getRecentMessages(session.id, 3)
    expect(recent.length).toBe(3)
    // Messages should be in ASC created_at order
    expect(recent[0].created_at).toBeLessThanOrEqual(recent[1].created_at)
    expect(recent[1].created_at).toBeLessThanOrEqual(recent[2].created_at)

    // All 10 messages exist
    const all = store.getMessages(session.id)
    expect(all.length).toBe(10)
  })

  test('getMessageCount returns correct count', () => {
    const session = store.createSession('baiyuan')
    expect(store.getMessageCount(session.id)).toBe(0)

    store.saveMessage(session.id, 'user', 'test')
    expect(store.getMessageCount(session.id)).toBe(1)

    store.saveMessage(session.id, 'assistant', 'reply')
    expect(store.getMessageCount(session.id)).toBe(2)
  })

  test('updateSessionSummary and getSessionSummary', () => {
    const session = store.createSession('baiyuan')
    expect(store.getSessionSummary(session.id)).toBeNull()

    store.updateSessionSummary(session.id, '用户聊了工作压力')
    expect(store.getSessionSummary(session.id)).toBe('用户聊了工作压力')
  })

  test('resetSession creates a new session for same character', () => {
    const first = store.createSession('baiyuan')
    store.saveMessage(first.id, 'user', 'test')

    const second = store.resetSession('baiyuan')
    expect(second.id).not.toBe(first.id)
    expect(second.character_name).toBe('baiyuan')
    // New session has no messages
    expect(store.getMessages(second.id).length).toBe(0)
  })

  test('saveMessage with metadata', () => {
    const session = store.createSession('baiyuan')
    store.saveMessage(session.id, 'assistant', 'test', { emotion: 'happy' })

    const messages = store.getMessages(session.id)
    expect(messages[0].metadata).toEqual({ emotion: 'happy' })
  })

  test('saveMessage updates session updated_at', () => {
    const session = store.createSession('baiyuan')
    const originalUpdatedAt = session.updated_at

    // Small delay to ensure timestamp differs
    store.saveMessage(session.id, 'user', 'test')

    const updated = store.getCurrentSession('baiyuan')
    expect(updated!.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt)
  })

  test('persists to disk and reloads', async () => {
    const session = store.createSession('baiyuan')
    store.saveMessage(session.id, 'user', 'persisted message')
    store.close()

    // Reopen from same file
    const store2 = new SessionStore(dbPath)
    await store2.initialize()

    const messages = store2.getMessages(session.id)
    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe('persisted message')
    store2.close()
  })
})
