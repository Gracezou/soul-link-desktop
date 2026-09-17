import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './chat.module.css'

export function NotConfiguredHint(): React.ReactElement {
  const { t } = useTranslation()

  return (
    <div className={styles.notConfiguredHint}>
      <span className={styles.notConfiguredText}>{t('chat.notConfigured')}</span>
      <button
        className={styles.notConfiguredButton}
        type="button"
        onClick={() => window.electronAPI?.send('window:open-settings')}
      >
        {t('chat.openSettings')}
      </button>
    </div>
  )
}
