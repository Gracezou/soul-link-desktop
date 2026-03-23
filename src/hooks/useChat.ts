import { useChatStore } from '../stores/chatStore'

export function useChat() {
  const messages = useChatStore(s => s.messages)
  const isLoading = useChatStore(s => s.isLoading)
  const isConnected = useChatStore(s => s.isConnected)
  const sessionReady = useChatStore(s => s.sessionReady)
  const addUserMessage = useChatStore(s => s.addUserMessage)

  async function sendMessage(text: string): Promise<void> {
    if (!text.trim() || !sessionReady) return
    addUserMessage(text)
    await window.electronAPI.invoke('bridge:send', { message: text })
  }

  return { messages, isLoading, isConnected, sessionReady, sendMessage }
}
