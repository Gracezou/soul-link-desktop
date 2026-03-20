import React from 'react'
import type { ChatMessage } from '../stores/chatStore'
import styles from './chat.module.css'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props): React.ReactElement {
  const isUser = message.role === 'user'

  function renderAssistantText(text: string): React.ReactNode {
    // Split by *action* patterns and render italic
    const parts = text.split(/(\*[^*]+\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className={styles.action}>{part.slice(1, -1)}</em>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className={`${styles.messageBubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
      {isUser
        ? <span>{message.text}</span>
        : renderAssistantText(message.text)
      }
      <span className={styles.timestamp}>
        {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
