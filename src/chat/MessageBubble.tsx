import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '../stores/chatStore'
import styles from './chat.module.css'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props): React.ReactElement {
  const { i18n } = useTranslation()
  const isUser = message.role === 'user'

  function renderAssistantText(text: string): React.ReactNode {
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
        {new Date(message.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
