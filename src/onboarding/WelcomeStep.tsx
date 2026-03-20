import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './onboarding.module.css'

interface WelcomeStepProps {
  language: string
  onLanguageChange: (lang: string) => void
  onNext: () => void
}

export function WelcomeStep({ language, onLanguageChange, onNext }: WelcomeStepProps): React.ReactElement {
  const { t, i18n } = useTranslation()

  function handleLanguageChange(lang: string) {
    onLanguageChange(lang)
    void i18n.changeLanguage(lang)
  }

  return (
    <>
      <h1 className={styles.stepTitle}>{t('onboarding.welcome.title')}</h1>
      <p className={styles.stepSubtitle}>{t('onboarding.welcome.subtitle')}</p>

      <div className={styles.field}>
        <span className={styles.label}>{t('onboarding.welcome.selectLanguage')}</span>
        <div className={styles.langRow}>
          <button
            className={`${styles.langBtn} ${language === 'zh-CN' ? styles.selected : ''}`}
            onClick={() => handleLanguageChange('zh-CN')}
          >
            简体中文
          </button>
          <button
            className={`${styles.langBtn} ${language === 'en' ? styles.selected : ''}`}
            onClick={() => handleLanguageChange('en')}
          >
            English
          </button>
        </div>
      </div>

      <div className={styles.navRow}>
        <button className={styles.btnPrimary} onClick={onNext}>
          {t('common.next')}
        </button>
      </div>
    </>
  )
}
