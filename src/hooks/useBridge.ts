import { useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { usePetStore } from '../stores/petStore'

// Inline bridge message types — do not import from electron/ (cross-process boundary)
interface BridgeMessage {
  runId: string
  text: string
}

interface BridgeSessionStatus {
  ready: boolean
  card: string
}

// Access the electronAPI exposed via preload
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data?: unknown) => void
      invoke: (channel: string, data?: unknown) => Promise<unknown>
      on: (channel: string, callback: (...args: unknown[]) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

export function useBridge(): void {
  const addAssistantMessage = useChatStore(s => s.addAssistantMessage)
  const setSessionStatus = useChatStore(s => s.setSessionStatus)
  const setAnimationFromEmotion = usePetStore(s => s.setAnimationFromEmotion)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.on('bridge:message', (...args: unknown[]) => {
      const msg = args[0] as BridgeMessage
      addAssistantMessage(msg.text)
      // TODO: get emotion from parsed response and update pet animation
    })

    api.on('bridge:session', (...args: unknown[]) => {
      const status = args[0] as BridgeSessionStatus
      setSessionStatus(status.ready, status.card)
    })

    api.on('bridge:connected', () => {
      console.log('[useBridge] Connected to gateway')
    })

    api.on('bridge:disconnected', () => {
      console.log('[useBridge] Disconnected from gateway')
    })

    return () => {
      api.removeAllListeners('bridge:message')
      api.removeAllListeners('bridge:session')
      api.removeAllListeners('bridge:connected')
      api.removeAllListeners('bridge:disconnected')
    }
  }, [addAssistantMessage, setSessionStatus, setAnimationFromEmotion])
}
