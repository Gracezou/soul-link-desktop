import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage } from '../stores/chatStore'
import styles from './chat.module.css'

export function ChatHistory(): React.ReactElement {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const handleClose = (): void => {
    window.electronAPI?.send('window:close-history')
    window.close()
  }

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.invoke('agent:get-history').then((history) => {
      const raw = history as Array<{ id: string; role: string; content: string; created_at: string }>
      setMessages(raw.map(msg => ({ id: msg.id, role: msg.role as 'user' | 'assistant', text: msg.content, timestamp: new Date(msg.created_at).getTime() })))
    })

    const handler = (...args: unknown[]) => {
      const raw = (args[0] as { message: { id: string; role: string; content: string; created_at: string } }).message
      setMessages(prev => [...prev, { id: raw.id, role: raw.role as 'user' | 'assistant', text: raw.content, timestamp: new Date(raw.created_at).getTime() }])
    }
    const off = api.on('agent:message-saved', handler)
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
          className={styles.chatHeaderButton}
          type="button"
          onClick={handleClose}
          title={t('common.close')}
          aria-label={t('common.close')}
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
