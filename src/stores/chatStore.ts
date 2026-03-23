import { create } from 'zustand'
import { parseResponse } from '../utils/responseParser'
import type { ParsedResponse } from '../utils/responseParser'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  parsed?: ParsedResponse
  timestamp: number
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isConnected: boolean
  sessionReady: boolean
  currentCard: string
  addUserMessage: (text: string) => void
  addAssistantMessage: (text: string) => void
  setLoading: (loading: boolean) => void
  setConnected: (connected: boolean) => void
  setSessionStatus: (ready: boolean, card: string) => void
  clearMessages: () => void
}

let msgIdCounter = 0

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  isConnected: false,
  sessionReady: false,
  currentCard: '',

  addUserMessage: (text) => {
    const msg: ChatMessage = {
      id: `msg-${++msgIdCounter}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    }
    set(state => ({ messages: [...state.messages, msg], isLoading: true }))
  },

  addAssistantMessage: (text) => {
    const parsed = parseResponse(text)
    const msg: ChatMessage = {
      id: `msg-${++msgIdCounter}`,
      role: 'assistant',
      text: parsed.displayText,
      parsed,
      timestamp: Date.now(),
    }
    set(state => ({ messages: [...state.messages, msg], isLoading: false }))
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setConnected: (connected) => set({ isConnected: connected }),

  setSessionStatus: (ready, card) => set({
    sessionReady: ready,
    currentCard: card,
    // When session drops, WebSocket connection is also gone
    ...(ready ? {} : { isConnected: false }),
  }),

  clearMessages: () => set({ messages: [] }),
}))
