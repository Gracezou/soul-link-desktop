import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolbarItem } from './ToolbarItem'
import styles from './toolbar.module.css'

interface ToolbarProps {
  visible?: boolean
  onChatClick?: () => void
}

export function Toolbar({ visible, onChatClick }: ToolbarProps): React.ReactElement {
  const { t } = useTranslation()

  const handleToggleChat = useCallback(() => {
    if (onChatClick) {
      onChatClick()
    } else {
      window.electronAPI?.send('window:toggle-chat')
    }
  }, [onChatClick])

  const handleOpenSettings = useCallback(() => {
    window.electronAPI?.send('window:open-settings')
  }, [])

  return (
    <div className={`${styles.toolbar} ${visible ? styles.visible : ''}`}>
      <ToolbarItem icon="💬" label={t('toolbar.chat')} onClick={handleToggleChat} />
      <ToolbarItem icon="⚙️" label={t('toolbar.settings')} onClick={handleOpenSettings} />
      <ToolbarItem icon="🎭" label={t('toolbar.character')} comingSoon />
      <ToolbarItem icon="📷" label={t('toolbar.photo')} comingSoon />
    </div>
  )
}
