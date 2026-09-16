import crypto from 'crypto'

import { createLogger, createConvLogger } from '../logger'
import { CharacterEngine } from './character-engine'
import { Compressor } from './compressor'
import { ContextManager } from './context-manager'
import { LlmClient } from './llm-client'
import { MemoryStore } from './memory-store'
import { checkOutOfCharacter } from './ooc-detector'
import { SessionStore } from './session-store'
import { extractEmotionFromResponse, stripThinking } from './tag-utils'
import { estimateMessagesTokens } from './token-counter'
import type { AgentConfig, CharacterCard, ChatMessage, Session, StreamCallbacks } from './types'

type LlmMessage = {
  role: string
  content: string
}

const OOC_RETRY_LIMIT = 2
const OOC_RETRY_SYSTEM_MESSAGE = 'Please stay in character. Do not mention that you are an AI.'

const COMPRESSION_THRESHOLD = 30

export class SoulLinkAgent {
  private readonly config: AgentConfig
  private readonly characterEngine: CharacterEngine
  private readonly sessionStore: SessionStore
  private readonly contextManager: ContextManager
  private readonly llmClient: LlmClient
  private readonly compressor: Compressor
  private readonly memoryStore: MemoryStore

  private readonly log = createLogger('Agent')
  private readonly convLog = createConvLogger()

  private currentCard: CharacterCard | null = null
  private currentSession: Session | null = null
  private mesExample = ''
  private initialized = false

  constructor(config: AgentConfig) {
    this.config = config
    this.characterEngine = new CharacterEngine(config.resBase)
    this.sessionStore = new SessionStore(config.dbPath)
    this.contextManager = new ContextManager(config)
    this.llmClient = new LlmClient(config)
    this.compressor = new Compressor(config)
    this.memoryStore = new MemoryStore(config)
  }

  async initialize(): Promise<void> {
    this.log.info('initialize', { card: this.config.cardName })
    await this.sessionStore.initialize()
    this.memoryStore.initializeWithDb(this.sessionStore.getDatabase())
    const card = this.characterEngine.loadCard(this.config.cardName)
    this.currentCard = card
    this.mesExample = this.characterEngine.getMesExample(card)
    this.currentSession = this.sessionStore.getOrCreateSession(card.name)
    this.initialized = true
    this.log.info('initialize:complete', { character: card.name, sessionId: this.currentSession.id })
  }

  async sendMessage(text: string, callbacks: StreamCallbacks): Promise<void> {
    const session = this.ensureSession()
    const card = this.currentCard!
    const userText = text.trim()
    const messageId = crypto.randomUUID()

    this.log.info('sendMessage', { messageId, textLength: userText.length })
    callbacks.onWaiting?.(messageId)

    const savedUserMessage = this.sessionStore.saveMessage(session.id, 'user', userText)
    const history = this.sessionStore.getMessages(session.id)
    const historyWithoutCurrentUser = this.excludeMessage(history, savedUserMessage.id)

    // Build system prompt with memories and summary
    const memories = this.memoryStore.getMemoriesForPrompt(card.name)
    const summary = this.sessionStore.getSessionSummary(session.id) ?? undefined
    const systemPrompt = this.characterEngine.buildSystemPrompt(card, memories || undefined, summary)

    let messages = this.contextManager.buildMessages({
      systemPrompt,
      mesExample: this.mesExample,
      history: historyWithoutCurrentUser,
      newUserMessage: userText
    })

    // Collect context info for conversation log
    const allMemories = this.memoryStore.getAllMemories(card.name)
    const contextInfo = {
      historyLength: historyWithoutCurrentUser.length,
      tokenEstimate: estimateMessagesTokens(messages),
      hasSummary: summary !== undefined,
      memoryCount: allMemories.length,
    }

    let oocRetryCount = 0

    for (let attempt = 0; attempt <= OOC_RETRY_LIMIT; attempt += 1) {
      const streamStart = Date.now()
      const result = await this.streamOnce(messages, messageId, callbacks)
      const streamLatency = Date.now() - streamStart

      if (result.error) {
        this.log.error('sendMessage:error', { messageId, error: result.error })
        callbacks.onError?.(messageId, result.error)
        return
      }

      const finalText = stripThinking(result.fullText).trim()
      const ooc = checkOutOfCharacter(finalText)

      if (ooc.detected && attempt < OOC_RETRY_LIMIT) {
        oocRetryCount += 1
        this.log.warn('sendMessage:oocRetry', { messageId, attempt: attempt + 1, pattern: ooc.matchedPattern })
        messages = this.appendRetrySystemMessage(messages)
        continue
      }

      const savedAssistantMessage = this.sessionStore.saveMessage(session.id, 'assistant', finalText)
      callbacks.onFinal?.(messageId, finalText)
      callbacks.onSaved?.(savedAssistantMessage)

      // Log conversation turn
      this.convLog.logTurn({
        sessionId: session.id,
        messageId,
        character: card.name,
        turn: { userMessage: userText, assistantMessage: finalText, rawResponse: result.fullText },
        analysis: {
          oocDetected: ooc.detected,
          oocPattern: ooc.matchedPattern,
          oocRetryCount,
          emotionTag: extractEmotionFromResponse(finalText),
        },
        context: contextInfo,
        timing: { latencyMs: streamLatency, deltaCount: result.deltaCount },
      })

      this.log.info('sendMessage:complete', { messageId })

      // Async post-processing (non-blocking)
      this.postProcess(session.id, card.name, userText, finalText).catch(() => {})
      return
    }
  }

  async getMemories(): Promise<import('./memory-store').Memory[]> {
    const card = this.currentCard
    if (!card) return []
    return this.memoryStore.getAllMemories(card.name)
  }

  private async postProcess(sessionId: string, characterName: string, userText: string, assistantText: string): Promise<void> {
    // Memory extraction
    this.log.info('postProcess:memoryExtraction', { sessionId })
    void this.memoryStore.extractAndSave(characterName, userText, assistantText)

    // Compression check
    const msgCount = this.sessionStore.getMessageCount(sessionId)
    if (msgCount > COMPRESSION_THRESHOLD) {
      this.log.info('postProcess:compression', { sessionId, msgCount })
      const allMessages = this.sessionStore.getMessages(sessionId)
      // Summarize the older half of messages
      const cutoff = Math.floor(allMessages.length / 2)
      const oldMessages = allMessages.slice(0, cutoff)
      if (oldMessages.length > 0) {
        const existing = this.sessionStore.getSessionSummary(sessionId) ?? undefined
        const newSummary = await this.compressor.compress(oldMessages, existing)
        if (newSummary) {
          this.sessionStore.updateSessionSummary(sessionId, newSummary)
        }
      }
    }
  }

  async getHistory(): Promise<ChatMessage[]> {
    const session = this.ensureSession()
    return this.sessionStore.getMessages(session.id)
  }

  async switchCharacter(cardName: string): Promise<void> {
    this.ensureInitialized()
    this.log.info('switchCharacter', { from: this.currentCard?.name, to: cardName })
    const card = this.characterEngine.loadCard(cardName)
    this.currentCard = card
    this.mesExample = this.characterEngine.getMesExample(card)
    this.currentSession = this.sessionStore.resetSession(card.name)
  }

  async resetSession(): Promise<void> {
    const session = this.ensureSession()
    this.currentSession = this.sessionStore.resetSession(session.character_name)
  }

  dispose(): void {
    this.log.info('dispose')
    this.sessionStore.close()
    this.initialized = false
    this.currentSession = null
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SoulLinkAgent is not initialized. Call initialize() first.')
    }
  }

  private ensureSession(): Session {
    this.ensureInitialized()
    if (!this.currentSession || !this.currentCard) {
      throw new Error('Current session is not available.')
    }
    return this.currentSession
  }

  private excludeMessage(messages: ChatMessage[], messageId: string): ChatMessage[] {
    return messages.filter((message) => message.id !== messageId)
  }

  private appendRetrySystemMessage(messages: LlmMessage[]): LlmMessage[] {
    return [...messages, { role: 'system', content: OOC_RETRY_SYSTEM_MESSAGE }]
  }

  private streamOnce(
    messages: LlmMessage[],
    messageId: string,
    callbacks: StreamCallbacks
  ): Promise<{ fullText: string; deltaCount: number; error?: string }> {
    return new Promise((resolve) => {
      let settled = false
      let fullText = ''
      let deltaCount = 0

      const done = (result: { fullText: string; deltaCount: number; error?: string }): void => {
        if (settled) {
          return
        }
        settled = true
        resolve(result)
      }

      void this.llmClient.streamChat(messages, {
        onDelta: (delta) => {
          fullText += delta
          deltaCount += 1
          // Send accumulated text, not incremental delta
          callbacks.onDelta?.(messageId, stripThinking(fullText))
        },
        onComplete: (completedText) => {
          const text = completedText.length > 0 ? completedText : fullText
          done({ fullText: text, deltaCount })
        },
        onError: (error) => {
          done({ fullText, deltaCount, error })
        }
      })
    })
  }
}
