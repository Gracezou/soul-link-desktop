import React from 'react'
import { useTranslation } from 'react-i18next'
import { applyTheme, getThemeList } from '../themes'
import type { ThemeName } from '../themes'
import styles from './onboarding.module.css'

interface WelcomeStepProps {
  language: string
  onLanguageChange: (lang: string) => void
  theme: string
  onThemeChange: (theme: string) => void
  onNext: () => void
}

export function WelcomeStep({ language, onLanguageChange, theme, onThemeChange, onNext }: WelcomeStepProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const themeList = getThemeList()

  function handleLanguageChange(lang: string) {
    onLanguageChange(lang)
    void i18n.changeLanguage(lang)
  }

  function handleThemeChange(name: ThemeName) {
    onThemeChange(name)
    applyTheme(name)
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

      <div className={styles.field}>
        <span className={styles.label}>{t('onboarding.welcome.selectTheme')}</span>
        <div className={styles.langRow}>
          {themeList.map(th => (
            <button
              key={th.name}
              className={`${styles.langBtn} ${theme === th.name ? styles.selected : ''}`}
              onClick={() => handleThemeChange(th.name)}
            >
              {i18n.language === 'zh-CN' ? th.label : th.labelEn}
            </button>
          ))}
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
