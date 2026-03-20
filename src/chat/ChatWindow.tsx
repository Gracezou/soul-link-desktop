import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageList } from './MessageList'
import { useChat } from '../hooks/useChat'
import styles from './chat.module.css'

export function ChatWindow(): React.ReactElement {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const { messages, isLoading, sessionReady, sendMessage } = useChat()

  async function handleSend(): Promise<void> {
    if (!input.trim()) return
    const text = input
    setInput('')
    await sendMessage(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className={styles.chatWindow}>
      <div className={styles.chatHeader}>
        <span className={styles.characterName}>{t('chat.title')}</span>
        <span className={styles.sessionStatus}>
          {sessionReady ? t('chat.statusConnected') : t('chat.statusDisconnected')}
        </span>
      </div>

      <MessageList messages={messages} />

      {isLoading && (
        <div className={styles.loadingIndicator}>{t('chat.loading')}</div>
      )}

      <div className={styles.inputArea}>
        <input
          className={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionReady ? t('chat.inputPlaceholder') : t('chat.inputPlaceholderWaiting')}
          disabled={!sessionReady || isLoading}
        />
        <button
          className={styles.sendButton}
          onClick={() => void handleSend()}
          disabled={!sessionReady || isLoading || !input.trim()}
        >
          {t('chat.send')}
        </button>
      </div>
    </div>
  )
}
