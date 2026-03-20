import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ChatBubble.module.css'

export function ChatBubble(): React.ReactElement {
  const { t } = useTranslation()
  const [isHovered, setIsHovered] = useState(false)

  function handleClick(): void {
    window.electronAPI?.send('chat:open')
  }

  return (
    <div
      className={`${styles.bubble} ${isHovered ? styles.hovered : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={t('chat.openChat')}
    >
      <span className={styles.icon}>💬</span>
    </div>
  )
}
