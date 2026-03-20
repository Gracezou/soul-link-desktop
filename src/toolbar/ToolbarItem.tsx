import React, { useState, useCallback } from 'react'
import styles from './toolbar.module.css'

interface ToolbarItemProps {
  icon: string
  label: string
  onClick?: () => void
  disabled?: boolean
  comingSoon?: boolean
}

export function ToolbarItem({ icon, label, onClick, disabled, comingSoon }: ToolbarItemProps): React.ReactElement {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = useCallback(() => {
    if (comingSoon || disabled) return
    onClick?.()
  }, [onClick, comingSoon, disabled])

  const tooltipText = comingSoon ? '即将推出' : label

  return (
    <button
      className={`${styles.toolbarItem} ${disabled || comingSoon ? styles.disabled : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title=""
    >
      {icon}
      {showTooltip && <span className={styles.tooltip}>{tooltipText}</span>}
    </button>
  )
}
