import React, { useCallback } from 'react'
import { ToolbarItem } from './ToolbarItem'
import styles from './toolbar.module.css'

interface ToolbarProps {
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function Toolbar({ onMouseEnter, onMouseLeave }: ToolbarProps): React.ReactElement {
  const handleToggleChat = useCallback(() => {
    window.electronAPI?.send('window:toggle-chat')
  }, [])

  const handleOpenSettings = useCallback(() => {
    window.electronAPI?.send('window:open-settings')
  }, [])

  return (
    <div
      className={styles.toolbar}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <ToolbarItem icon="💬" label="打开聊天" onClick={handleToggleChat} />
      <ToolbarItem icon="⚙️" label="设置" onClick={handleOpenSettings} />
      <ToolbarItem icon="🎭" label="切换角色" comingSoon />
      <ToolbarItem icon="📷" label="生成图片" comingSoon />
    </div>
  )
}
