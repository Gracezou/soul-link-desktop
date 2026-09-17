import { LLM_NOT_CONFIGURED_ERROR, SoulLinkAgent } from '../../electron/agent'
import * as oocDetector from '../../electron/agent/ooc-detector'
import type { AgentConfig, CharacterCard, ChatMessage, Session } from '../../electron/agent/types'

const configuredAgentConfig: AgentConfig = {
  baseUrl: 'https://example.test/v1',
  apiKey: 'test-key',
  model: 'test-model',
  cardName: 'test-card',
  resBase: '/tmp',
  dbPath: '/tmp/test.db',
  maxTotalTokens: 8000,
  systemPromptBudget: 2000,
  outputReserve: 500,
}

describe('SoulLinkAgent LLM configuration gate', () => {
  test.each([
    ['empty baseUrl', { baseUrl: '' }, false],
    ['whitespace-only baseUrl', { baseUrl: '  ' }, false],
    ['empty apiKey', { apiKey: '' }, false],
    ['whitespace-only apiKey', { apiKey: '  ' }, false],
    ['empty model', { model: '' }, false],
    ['whitespace-only model', { model: '  ' }, false],
    ['non-empty fields', {}, true],
    [
      'trimmed non-empty fields',
      { baseUrl: '  https://x  ', apiKey: ' k ', model: 'm' },
      true,
    ],
  ])('reports %s correctly', (_label, overrides, expected) => {
    const agent = new SoulLinkAgent({ ...configuredAgentConfig, ...overrides })

    expect(agent.isLlmConfigured()).toBe(expected)
  })

  test('rejects an unconfigured message before initialization, persistence, or callbacks', async () => {
    const apiKey = 'sensitive-test-key'
    const agent = new SoulLinkAgent({ ...configuredAgentConfig, apiKey, model: '' })
    const internal = agent as any
    const saveMessage = jest.fn()
    const streamChat = jest.fn()
    const warn = jest.fn()
    internal.sessionStore.saveMessage = saveMessage
    internal.llmClient.streamChat = streamChat
    internal.log = { info: jest.fn(), warn, error: jest.fn() }

    const callbacks = {
      onWaiting: jest.fn(),
      onDelta: jest.fn(),
      onFinal: jest.fn(),
      onError: jest.fn(),
      onSaved: jest.fn(),
    }

    await expect(agent.sendMessage('hi', callbacks)).resolves.toBeUndefined()

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(callbacks.onError).toHaveBeenCalledWith('', LLM_NOT_CONFIGURED_ERROR)
    expect(callbacks.onWaiting).not.toHaveBeenCalled()
    expect(callbacks.onDelta).not.toHaveBeenCalled()
    expect(callbacks.onFinal).not.toHaveBeenCalled()
    expect(callbacks.onSaved).not.toHaveBeenCalled()
    expect(saveMessage).not.toHaveBeenCalled()
    expect(streamChat).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('sendMessage:llmNotConfigured')
    expect(JSON.stringify(warn.mock.calls)).not.toContain(apiKey)
  })

  test.each(['baseUrl', 'apiKey', 'model'])(
    'treats undefined %s as unconfigured without throwing',
    (field) => {
      const agent = new SoulLinkAgent(configuredAgentConfig)
      const internal = agent as any
      internal.config = { ...configuredAgentConfig, [field]: undefined }

      expect(() => agent.isLlmConfigured()).not.toThrow()
      expect(agent.isLlmConfigured()).toBe(false)
    },
  )

  test('routes sendMessage through the unconfigured path when a field is undefined', async () => {
    const agent = new SoulLinkAgent(configuredAgentConfig)
    const internal = agent as any
    internal.config = { ...configuredAgentConfig, model: undefined }
    const saveMessage = jest.fn()
    const streamChat = jest.fn()
    const warn = jest.fn()
    internal.sessionStore.saveMessage = saveMessage
    internal.llmClient.streamChat = streamChat
    internal.log = { info: jest.fn(), warn, error: jest.fn() }

    const callbacks = {
      onWaiting: jest.fn(),
      onDelta: jest.fn(),
      onFinal: jest.fn(),
      onError: jest.fn(),
      onSaved: jest.fn(),
    }

    await expect(agent.sendMessage('hi', callbacks)).resolves.toBeUndefined()

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(callbacks.onError).toHaveBeenCalledWith('', LLM_NOT_CONFIGURED_ERROR)
    expect(callbacks.onWaiting).not.toHaveBeenCalled()
    expect(saveMessage).not.toHaveBeenCalled()
    expect(streamChat).not.toHaveBeenCalled()
  })
})

describe('SoulLinkAgent response validation', () => {
  test('reports a non-empty thinking-only response before OOC and persistence', async () => {
    const config = configuredAgentConfig
    const card: CharacterCard = {
      name: 'Test',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      system_prompt: '',
      post_history_instructions: '',
    }
    const session: Session = {
      id: 'session-1',
      character_name: card.name,
      created_at: 1,
      updated_at: 1,
    }
    const userMessage: ChatMessage = {
      id: 'user-1',
      session_id: session.id,
      role: 'user',
      content: 'hello',
      created_at: 1,
    }
    const saveMessage = jest.fn().mockReturnValue(userMessage)
    const logError = jest.fn()
    const logTurn = jest.fn()
    const extractAndSave = jest.fn()
    const oocSpy = jest.spyOn(oocDetector, 'checkOutOfCharacter')
    const agent = new SoulLinkAgent(config)
    const internal = agent as any

    internal.initialized = true
    internal.currentCard = card
    internal.currentSession = session
    internal.characterEngine = {
      buildSystemPrompt: jest.fn().mockReturnValue('system prompt'),
    }
    internal.sessionStore = {
      saveMessage,
      getMessages: jest.fn().mockReturnValue([userMessage]),
      getSessionSummary: jest.fn().mockReturnValue(null),
    }
    internal.contextManager = {
      buildMessages: jest.fn().mockReturnValue([]),
    }
    internal.memoryStore = {
      getMemoriesForPrompt: jest.fn().mockReturnValue(''),
      getAllMemories: jest.fn().mockReturnValue([]),
      extractAndSave,
    }
    internal.llmClient = {
      streamChat: jest.fn((_messages: unknown, callbacks: { onComplete: (text: string) => void }) => {
        callbacks.onComplete('<think>private reasoning</think>')
        return Promise.resolve()
      }),
    }
    internal.log = {
      info: jest.fn(),
      warn: jest.fn(),
      error: logError,
    }
    internal.convLog = { logTurn }

    const onError = jest.fn()
    const onFinal = jest.fn()
    const onSaved = jest.fn()

    await agent.sendMessage('hello', { onError, onFinal, onSaved })

    expect(logError).toHaveBeenCalledWith(
      'sendMessage:emptyResponseAfterThinking',
      expect.objectContaining({ error: expect.any(String) }),
    )
    expect(onError).toHaveBeenCalledWith(expect.any(String), expect.any(String))
    expect(oocSpy).not.toHaveBeenCalled()
    expect(saveMessage).toHaveBeenCalledTimes(1)
    expect(saveMessage).toHaveBeenCalledWith(session.id, 'user', 'hello')
    expect(onFinal).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(logTurn).not.toHaveBeenCalled()
    expect(extractAndSave).not.toHaveBeenCalled()

    oocSpy.mockRestore()
  })
})
