import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './settings.module.css'

export function AboutSection(): React.ReactElement {
  const { t } = useTranslation()
  const [resetting, setResetting] = useState(false)

  async function handleResetOnboarding(): Promise<void> {
    setResetting(true)
    await window.electronAPI?.invoke('settings:set', {
      onboarding: { completed: false },
    })
    window.electronAPI?.send('app:relaunch')
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('settings.about.title')}</h3>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.about.versionLabel')}</span>
        <span className={styles.value}>{t('settings.about.version')}</span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.about.techStackLabel')}</span>
        <span className={styles.value}>{t('settings.about.techStack')}</span>
      </div>

      <hr className={styles.divider} />

      <h3 className={styles.sectionTitle}>{t('settings.about.resetTitle')}</h3>
      <p className={styles.hint}>{t('settings.about.resetHint')}</p>

      <div className={styles.actions}>
        <button
          className={styles.btnSecondary}
          onClick={() => void handleResetOnboarding()}
          disabled={resetting}
        >
          {resetting ? t('settings.about.resetting') : t('settings.about.resetBtn')}
        </button>
      </div>
    </div>
  )
}
