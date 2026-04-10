import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './settings.module.css'

export function AboutSection(): React.ReactElement {
  const { t } = useTranslation()
  const [resetting, setResetting] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI?.invoke('app:get-version')
      .then((v) => setVersion(typeof v === 'string' ? v : null))
      .catch(() => setVersion(null))
  }, [])

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
        <span className={styles.value}>{version !== null ? t('settings.about.version', { version }) : 'Soul Link Desktop'}</span>
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
