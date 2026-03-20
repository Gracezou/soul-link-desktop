import React, { useState } from 'react'
import { MessageList } from './MessageList'
import { useChat } from '../hooks/useChat'
import styles from './chat.module.css'

export function ChatWindow(): React.ReactElement {
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
        <span className={styles.characterName}>柏源</span>
        <span className={styles.sessionStatus}>
          {sessionReady ? '● 已连接' : '○ 未连接'}
        </span>
      </div>

      <MessageList messages={messages} />

      {isLoading && (
        <div className={styles.loadingIndicator}>柏源正在回复…</div>
      )}

      <div className={styles.inputArea}>
        <input
          className={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionReady ? '发送消息…' : '等待连接…'}
          disabled={!sessionReady || isLoading}
        />
        <button
          className={styles.sendButton}
          onClick={() => void handleSend()}
          disabled={!sessionReady || isLoading || !input.trim()}
        >
          发送
        </button>
      </div>
    </div>
  )
}
