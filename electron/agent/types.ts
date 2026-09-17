// electron/agent/types.ts
// All interfaces for the SoulLink Agent module

export interface AgentConfig {
  baseUrl: string
  apiKey: string
  model: string
  cardName: string
  resBase: string
  dbPath: string
  maxTotalTokens: number
  systemPromptBudget: number
  outputReserve: number
}

export interface CharacterCard {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  system_prompt: string
  post_history_instructions: string
  tags?: string[]
  creator?: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: number
  metadata?: Record<string, unknown>
}

export interface Session {
  id: string
  character_name: string
  created_at: number
  updated_at: number
}

export interface StreamCallbacks {
  onWaiting?: (messageId: string) => void
  onDelta?: (messageId: string, delta: string) => void
  onFinal?: (messageId: string, fullText: string) => void
  onError?: (messageId: string, error: string) => void
  onSaved?: (message: ChatMessage) => void
}

export interface WaitingPayload {
  messageId: string
}

export interface DeltaPayload {
  messageId: string
  delta: string
}

export interface FinalPayload {
  messageId: string
  text: string
}

export interface ErrorPayload {
  messageId: string
  error: string
}

export interface MessageSavedPayload {
  message: ChatMessage
}

export interface AgentStatus {
  ready: boolean
  character: string
  /** Agent construction-time baseUrl/apiKey/model are all non-empty. Does not imply gateway reachability. */
  llmConfigured: boolean
}
