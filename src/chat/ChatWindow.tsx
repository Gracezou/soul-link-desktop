import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageList } from './MessageList'
import { NotConfiguredHint } from './NotConfiguredHint'
import { useChat } from '../hooks/useChat'
import styles from './chat.module.css'

export function ChatWindow(): React.ReactElement {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const { messages, isLoading, isConnected, sessionReady, llmConfigured, sendMessage } = useChat()

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

  const statusKey = sessionReady
    ? 'chat.statusConnected'
    : isConnected
      ? 'chat.statusConnecting'
      : 'chat.statusDisconnected'
  const statusColor = sessionReady ? '#4caf50' : isConnected ? '#ff9800' : '#9e9e9e'

  return (
    <div className={styles.chatWindow}>
      <div className={styles.chatHeader}>
        <span className={styles.characterName}>{t('chat.title')}</span>
        <span className={styles.sessionStatus} style={{ color: statusColor }}>
          {t(statusKey)}
        </span>
      </div>

      <MessageList messages={messages} />

      {isLoading && (
        <div className={styles.loadingIndicator}>{t('chat.loading')}</div>
      )}

      {llmConfigured === false && <NotConfiguredHint />}

      <div className={styles.inputArea}>
        <input
          className={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={llmConfigured === false
            ? t('chat.inputPlaceholderNotConfigured')
            : sessionReady
              ? t('chat.inputPlaceholder')
              : t('chat.inputPlaceholderWaiting')}
          disabled={llmConfigured === false || !sessionReady || isLoading}
        />
        <button
          className={styles.sendButton}
          onClick={() => void handleSend()}
          disabled={llmConfigured === false || !sessionReady || isLoading || !input.trim()}
        >
          {t('chat.send')}
        </button>
      </div>
    </div>
  )
}
