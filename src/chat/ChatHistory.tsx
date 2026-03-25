import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage } from '../stores/chatStore'
import styles from './chat.module.css'

export function ChatHistory(): React.ReactElement {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.invoke('chat:get-history').then((history) => {
      setMessages(history as ChatMessage[])
    })

    const handler = (...args: unknown[]) => {
      const msg = args[0] as ChatMessage
      setMessages(prev => [...prev, msg])
    }
    const off = api.on('chat:on-message', handler)
    return () => { off() }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.chatHistory}>
      <div className={styles.chatHeader}>
        <span className={styles.characterName}>{t('chat.historyTitle')}</span>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
          onClick={() => window.electronAPI?.send('window:close')}
        >
          ✕
        </button>
      </div>
      <div className={styles.messageList}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 14, marginTop: 40 }}>
            {t('chat.emptyHistory')}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
