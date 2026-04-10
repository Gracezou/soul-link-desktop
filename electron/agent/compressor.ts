import { createLogger } from '../logger'
import { LlmClient } from './llm-client'
import type { AgentConfig, ChatMessage } from './types'

export class Compressor {
  private readonly llmClient: LlmClient
  private readonly log = createLogger('Compressor')

  constructor(config: Pick<AgentConfig, 'baseUrl' | 'apiKey' | 'model'>) {
    this.llmClient = new LlmClient(config)
  }

  async compress(messages: ChatMessage[], existingSummary?: string): Promise<string> {
    if (messages.length === 0) return existingSummary ?? ''
    this.log.info('compress', { messageCount: messages.length, hasExisting: !!existingSummary })

    const conversationText = messages
      .map(m => `${m.role === 'user' ? '用户' : '角色'}: ${m.content}`)
      .join('\n')

    let prompt = '将以下对话压缩为简短摘要，保留：话题、关键动作、用户情绪、重要约定。2-3句话。\n\n'
    if (existingSummary) {
      prompt += `之前的摘要：${existingSummary}\n\n新增对话：\n`
    }
    prompt += conversationText

    try {
      const result = await this.llmClient.chatCompletion(
        [
          { role: 'system', content: '你是一个对话摘要工具。请用简洁的中文概括对话要点。' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.3, max_tokens: 200 }
      )
      return result.trim() || existingSummary || ''
    } catch {
      return existingSummary || ''
    }
  }
}
