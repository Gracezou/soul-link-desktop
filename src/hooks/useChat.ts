import { useChatStore } from '../stores/chatStore'

export function useChat() {
  const messages = useChatStore(s => s.messages)
  const isLoading = useChatStore(s => s.isLoading)
  const isConnected = useChatStore(s => s.isConnected)
  const sessionReady = useChatStore(s => s.sessionReady)
  const llmConfigured = useChatStore(s => s.llmConfigured)
  const addUserMessage = useChatStore(s => s.addUserMessage)

  function sendMessage(text: string): void {
    if (llmConfigured === false || !text.trim() || !sessionReady) return
    addUserMessage(text)
    window.electronAPI.send('agent:send', { message: text })
  }

  return { messages, isLoading, isConnected, sessionReady, llmConfigured, sendMessage }
}
