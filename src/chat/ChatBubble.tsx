import React, { useState } from 'react'
import styles from './ChatBubble.module.css'

export function ChatBubble(): React.ReactElement {
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
      title="打开聊天"
    >
      <span className={styles.icon}>💬</span>
    </div>
  )
}
