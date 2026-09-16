import { SoulLinkAgent } from '../../electron/agent'
import * as oocDetector from '../../electron/agent/ooc-detector'
import type { AgentConfig, CharacterCard, ChatMessage, Session } from '../../electron/agent/types'

describe('SoulLinkAgent response validation', () => {
  test('reports a non-empty thinking-only response before OOC and persistence', async () => {
    const config: AgentConfig = {
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
