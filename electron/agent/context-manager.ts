import type { AgentConfig, ChatMessage } from './types'
import { estimateMessagesTokens } from './token-counter'

interface BuildMessagesOptions {
  systemPrompt: string
  mesExample: string
  history: ChatMessage[]
  newUserMessage: string
}

interface LLMMessage {
  role: string
  content: string
}

function normalizeRole(role: string): string {
  if (role === 'assistant' || role === 'system' || role === 'user') {
    return role
  }
  return 'user'
}

function parseMesExample(mesExample: string): LLMMessage[] {
  const raw = mesExample.trim()
  if (!raw) {
    return []
  }

  const lines = raw.split(/\r?\n/)
  const result: LLMMessage[] = []

  let currentRole: 'user' | 'assistant' | null = null
  let buffer: string[] = []

  const flush = (): void => {
    if (!currentRole) {
      return
    }
    const content = buffer.join('\n').trim()
    if (content) {
      result.push({ role: currentRole, content })
    }
    buffer = []
  }

  const userPrefix = /^(?:\{\{\s*user\s*\}\}|user|用户)\s*[:：]\s*(.*)$/i
  const assistantPrefix =
    /^(?:\{\{\s*(?:char|character)\s*\}\}|assistant|char|bot|角色)\s*[:：]\s*(.*)$/i

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^<\s*start\s*>$/i.test(trimmed)) {
      continue
    }

    const userMatch = trimmed.match(userPrefix)
    if (userMatch) {
      flush()
      currentRole = 'user'
      buffer.push((userMatch[1] ?? '').trim())
      continue
    }

    const assistantMatch = trimmed.match(assistantPrefix)
    if (assistantMatch) {
      flush()
      currentRole = 'assistant'
      buffer.push((assistantMatch[1] ?? '').trim())
      continue
    }

    if (!currentRole) {
      currentRole = 'assistant'
    }
    buffer.push(line)
  }

  flush()

  if (result.length > 0) {
    return result
  }

  return [{ role: 'assistant', content: raw }]
}

export class ContextManager {
  private readonly config: Pick<AgentConfig, 'maxTotalTokens' | 'systemPromptBudget' | 'outputReserve'>

  constructor(config: Pick<AgentConfig, 'maxTotalTokens' | 'systemPromptBudget' | 'outputReserve'>) {
    this.config = config
  }

  buildMessages(opts: BuildMessagesOptions): LLMMessage[] {
    const historyBudget = Math.max(
      0,
      this.config.maxTotalTokens - this.config.systemPromptBudget - this.config.outputReserve
    )

    const messages: LLMMessage[] = [{ role: 'system', content: opts.systemPrompt }]

    let remaining = historyBudget

    const mesExampleMessages = parseMesExample(opts.mesExample)
    if (mesExampleMessages.length > 0) {
      const mesTokens = estimateMessagesTokens(mesExampleMessages)
      if (mesTokens <= remaining) {
        messages.push(...mesExampleMessages)
        remaining -= mesTokens
      }
    }

    const selectedHistory: LLMMessage[] = []
    for (let i = opts.history.length - 1; i >= 0; i -= 1) {
      const item = opts.history[i]
      const candidate: LLMMessage = {
        role: normalizeRole(item.role),
        content: item.content,
      }
      const candidateTokens = estimateMessagesTokens([candidate])
      if (candidateTokens > remaining) {
        break
      }
      selectedHistory.unshift(candidate)
      remaining -= candidateTokens
    }

    messages.push(...selectedHistory)
    messages.push({ role: 'user', content: opts.newUserMessage })

    return messages
  }
}
