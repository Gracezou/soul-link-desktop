import { ContextManager } from '../../electron/agent/context-manager'
import { generateMessages } from '../fixtures/sample-messages'

describe('ContextManager', () => {
  describe('buildMessages — sliding window', () => {
    test('returns all history when within budget', () => {
      const history = generateMessages(6) // 3 rounds, small token count
      const cm = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
      })

      const messages = cm.buildMessages({
        systemPrompt: '你是柏源',
        mesExample: '',
        history,
        newUserMessage: '你好',
      })

      // system + 6 history + 1 new user = 8
      expect(messages.length).toBe(8)
      expect(messages[0].role).toBe('system')
      expect(messages[messages.length - 1].content).toBe('你好')
    })

    test('trims old messages when exceeding budget', () => {
      const history = generateMessages(40) // lots of messages
      const cm = new ContextManager({
        maxTotalTokens: 500, // very tight budget
        systemPromptBudget: 200,
        outputReserve: 200,
      })

      const messages = cm.buildMessages({
        systemPrompt: '你是柏源',
        mesExample: '',
        history,
        newUserMessage: '你好',
      })

      // Should have fewer than 40 history messages + system + user
      expect(messages.length).toBeLessThan(42)
      // Last message should always be the new user message
      expect(messages[messages.length - 1].content).toBe('你好')
      expect(messages[messages.length - 1].role).toBe('user')
    })

    test('always includes system prompt and new user message', () => {
      const history = generateMessages(2)
      const cm = new ContextManager({
        maxTotalTokens: 100, // very tight
        systemPromptBudget: 50,
        outputReserve: 50,
      })

      const messages = cm.buildMessages({
        systemPrompt: '你是柏源',
        mesExample: '',
        history,
        newUserMessage: '你好',
      })

      // At minimum: system + user message
      expect(messages.length).toBeGreaterThanOrEqual(2)
      expect(messages[0].role).toBe('system')
      expect(messages[messages.length - 1].role).toBe('user')
    })

    test('preserves most recent history over older', () => {
      const history = generateMessages(20)
      const cm = new ContextManager({
        maxTotalTokens: 800,
        systemPromptBudget: 200,
        outputReserve: 200,
      })

      const messages = cm.buildMessages({
        systemPrompt: '你是柏源',
        mesExample: '',
        history,
        newUserMessage: '你好',
      })

      // The last history message before user message should be the most recent
      const historyPart = messages.slice(1, -1) // exclude system and new user
      if (historyPart.length > 0) {
        const lastHistoryContent = historyPart[historyPart.length - 1].content
        expect(lastHistoryContent).toBe(history[history.length - 1].content)
      }
    })
  })

  describe('buildMessages — mesExample', () => {
    test('includes mesExample when budget allows', () => {
      const cm = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
      })

      const messages = cm.buildMessages({
        systemPrompt: '你是柏源',
        mesExample: '{{user}}: 你好\n{{char}}: *微笑* "你好啊"',
        history: [],
        newUserMessage: '早上好',
      })

      // system + mesExample messages + user
      expect(messages.length).toBeGreaterThanOrEqual(3)
    })

    test('skips mesExample when empty', () => {
      const cm = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
      })

      const messages = cm.buildMessages({
        systemPrompt: '你是柏源',
        mesExample: '',
        history: [],
        newUserMessage: '你好',
      })

      // system + user only
      expect(messages.length).toBe(2)
    })
  })
})
