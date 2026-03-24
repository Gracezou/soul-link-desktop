import React, { useEffect, useRef, useState } from 'react'
import styles from './chat.module.css'

function parseContent(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className={styles.action}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}

interface ChatBubbleFeedbackProps {
  message: string | null
  onDismiss: () => void
}

export function ChatBubbleFeedback({ message, onDismiss }: ChatBubbleFeedbackProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 8000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [message]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!message) return null

  return (
    <div
      className={`${styles.chatBubble} ${visible ? styles.chatBubbleVisible : ''}`}
      onClick={() => { setVisible(false); onDismiss() }}
    >
      {parseContent(message)}
    </div>
  )
}
