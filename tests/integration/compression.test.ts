import path from 'path'
import fs from 'fs'
import os from 'os'
import { SoulLinkAgent } from '../../electron/agent'
import { getCPAConfig, skipIfNoCPA } from './helpers'

describe('Compression (integration)', () => {
  if (skipIfNoCPA()) {
    test.skip('skipped — CPA_API_KEY not set', () => {})
    return
  }

  test('agent handles multiple rounds of conversation', async () => {
    const dbPath = path.join(os.tmpdir(), `soul-link-test-compress-${Date.now()}.db`)
    const cpaConfig = getCPAConfig()
    const resBase = path.join(__dirname, '../../res')

    const agent = new SoulLinkAgent({
      ...cpaConfig,
      cardName: 'baiyuan',
      resBase,
      dbPath,
      maxTotalTokens: 8192,
      systemPromptBudget: 2000,
      outputReserve: 1200,
    })

    await agent.initialize()

    const prompts = [
      '你好',
      '今天天气怎么样？',
      '我最近工作很忙',
      '你会做什么菜？',
    ]

    for (const prompt of prompts) {
      await agent.sendMessage(prompt, {
        onDelta: () => {},
        onFinal: () => {},
        onError: (_messageId, err) => console.error('Error:', err),
      })
    }

    // Verify history is accumulating
    const history = await agent.getHistory()
    expect(history.length).toBeGreaterThanOrEqual(8) // 4 user + 4 assistant

    agent.dispose()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  }, 120000) // 2 min timeout — multiple LLM calls
})
