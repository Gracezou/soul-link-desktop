import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PresetButtons } from './PresetButtons'
import styles from './chat.module.css'

interface CompactInputProps {
  visible: boolean
  onSend: (message: string) => void
  onOpenHistory: () => void
}

export function CompactInput({ visible, onSend, onOpenHistory }: CompactInputProps): React.ReactElement {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const handleSend = () => {
    const msg = text.trim()
    if (!msg) return
    onSend(msg)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`${styles.compactInput} ${visible ? styles.compactInputVisible : ''}`}>
      <div className={styles.inputRow}>
        <input
          className={styles.inputField}
          type="text"
          placeholder={t('chat.inputPlaceholder')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className={styles.compactSendButton} onClick={handleSend} disabled={!text.trim()}>
          ➤
        </button>
      </div>
      <PresetButtons onSend={onSend} />
      <button className={styles.historyLink} onClick={onOpenHistory}>
        {t('chat.viewHistory')}
      </button>
    </div>
  )
}
