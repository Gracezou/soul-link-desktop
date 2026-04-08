import { useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { usePetStore } from '../stores/petStore'
import { parseResponse } from '../utils/responseParser'
import { mapEmotionToAnimation } from '../utils/emotionMapper'

interface AgentMessage {
  messageId: string
  text: string
}

interface AgentReadyStatus {
  ready: boolean
  character: string
}

declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data?: unknown) => void
      invoke: (channel: string, data?: unknown) => Promise<unknown>
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
      removeAllListeners: (channel: string) => void
    }
  }
}

export function useAgent(): void {
  const addAssistantMessage = useChatStore(s => s.addAssistantMessage)
  const setConnected = useChatStore(s => s.setConnected)
  const setSessionStatus = useChatStore(s => s.setSessionStatus)
  const setAnimationFromEmotion = usePetStore(s => s.setAnimationFromEmotion)
  const addFV = usePetStore(s => s.addFV)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    void api.invoke('agent:get-status').then((status) => {
      const s = status as AgentReadyStatus
      if (s?.ready) {
        setSessionStatus(s.ready, s.character)
        setConnected(true)
      }
    })

    const offReady = api.on('agent:ready', (...args: unknown[]) => {
      const status = args[0] as AgentReadyStatus
      setSessionStatus(status.ready, status.character)
      if (status.ready) setConnected(true)
    })

    const offFinal = api.on('agent:final', (...args: unknown[]) => {
      const msg = args[0] as AgentMessage
      addAssistantMessage(msg.text)
      const parsed = parseResponse(msg.text)
      const cmd = mapEmotionToAnimation(parsed)
      setAnimationFromEmotion(parsed.emotions[0] ?? 'talk')
      addFV(cmd.fvDelta)
    })

    return () => {
      offReady()
      offFinal()
    }
  }, [addAssistantMessage, setConnected, setSessionStatus, setAnimationFromEmotion, addFV])
}
