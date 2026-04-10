import path from 'path'
import fs from 'fs'
import os from 'os'
import { SoulLinkAgent } from '../../electron/agent'
import { getCPAConfig, skipIfNoCPA } from './helpers'

describe('SoulLinkAgent pipeline (integration)', () => {
  if (skipIfNoCPA()) {
    test.skip('skipped — CPA_API_KEY not set', () => {})
    return
  }

  let agent: SoulLinkAgent
  let dbPath: string
  const cpaConfig = getCPAConfig()
  const resBase = path.join(__dirname, '../../res')

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `soul-link-test-agent-${Date.now()}.db`)

    agent = new SoulLinkAgent({
      ...cpaConfig,
      cardName: 'baiyuan',
      resBase,
      dbPath,
      maxTotalTokens: 8192,
      systemPromptBudget: 2000,
      outputReserve: 1200,
    })

    await agent.initialize()
  })

  afterAll(() => {
    if (agent) agent.dispose()
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  test('sends message and receives character response', async () => {
    let finalText = ''
    let finalMessageId = ''

    await agent.sendMessage('你好', {
      onWaiting: (messageId) => { finalMessageId = messageId },
      onDelta: () => {},
      onFinal: (_messageId, text) => { finalText = text },
      onError: (_messageId, err) => { throw new Error(err) },
    })

    expect(finalMessageId).toBeTruthy()
    expect(finalText).toBeTruthy()
    expect(finalText.length).toBeGreaterThan(0)
  }, 30000)

  test('message is saved to history', async () => {
    const history = await agent.getHistory()
    // Should have at least 2 messages (user + assistant from previous test)
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history.find(m => m.role === 'user')).toBeTruthy()
    expect(history.find(m => m.role === 'assistant')).toBeTruthy()
  })

  test('second message maintains context', async () => {
    let finalText = ''

    await agent.sendMessage('你刚才说了什么？', {
      onDelta: () => {},
      onFinal: (_messageId, text) => { finalText = text },
      onError: (_messageId, err) => { throw new Error(err) },
    })

    expect(finalText).toBeTruthy()

    const history = await agent.getHistory()
    // Should now have 4+ messages (2 rounds)
    expect(history.length).toBeGreaterThanOrEqual(4)
  }, 30000)

  test('resetSession clears history but agent still works', async () => {
    await agent.resetSession()
    const history = await agent.getHistory()
    expect(history.length).toBe(0)

    let finalText = ''
    await agent.sendMessage('重置后的第一条消息', {
      onDelta: () => {},
      onFinal: (_messageId, text) => { finalText = text },
      onError: (_messageId, err) => { throw new Error(err) },
    })

    expect(finalText).toBeTruthy()
  }, 30000)
})
