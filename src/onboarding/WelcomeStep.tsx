import React from 'react'
import styles from './onboarding.module.css'

interface WelcomeStepProps {
  language: string
  onLanguageChange: (lang: string) => void
  onNext: () => void
}

export function WelcomeStep({ language, onLanguageChange, onNext }: WelcomeStepProps): React.ReactElement {
  const isCN = language === 'zh-CN'

  return (
    <>
      <h1 className={styles.stepTitle}>
        {isCN ? '欢迎来到 Soul Link ✨' : 'Welcome to Soul Link ✨'}
      </h1>
      <p className={styles.stepSubtitle}>
        {isCN ? '你的 AI 桌面情感伴侣' : 'Your AI desktop companion'}
      </p>

      <div className={styles.field}>
        <span className={styles.label}>{isCN ? '选择语言' : 'Select Language'}</span>
        <div className={styles.langRow}>
          <button
            className={`${styles.langBtn} ${language === 'zh-CN' ? styles.selected : ''}`}
            onClick={() => onLanguageChange('zh-CN')}
          >
            简体中文
          </button>
          <button
            className={`${styles.langBtn} ${language === 'en' ? styles.selected : ''}`}
            onClick={() => onLanguageChange('en')}
          >
            English
          </button>
        </div>
      </div>

      <div className={styles.navRow}>
        <button className={styles.btnPrimary} onClick={onNext}>
          {isCN ? '下一步' : 'Next'}
        </button>
      </div>
    </>
  )
}
