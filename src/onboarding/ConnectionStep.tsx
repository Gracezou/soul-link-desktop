import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './onboarding.module.css'

interface ConnectionStepProps {
  gatewayWsUrl: string
  authToken: string
  onGatewayChange: (v: string) => void
  onTokenChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

export function ConnectionStep({
  gatewayWsUrl,
  authToken,
  onGatewayChange,
  onTokenChange,
  onNext,
  onBack,
}: ConnectionStepProps): React.ReactElement {
  const { t } = useTranslation()
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.electronAPI?.invoke('bridge:test-connection', {
        gatewayWsUrl,
        authToken,
      }) as { success: boolean; error?: string } | undefined
      
      if (result?.success) {
        setTestResult({ success: true, message: t('onboarding.connection.testSuccess') })
      } else {
        setTestResult({ success: false, message: result?.error ?? t('onboarding.connection.testFailed') })
      }
    } catch {
      setTestResult({ success: false, message: t('onboarding.connection.testError') })
    } finally {
      setTesting(false)
    }
  }, [gatewayWsUrl, authToken, t])

  const canProceed = testResult?.success === true

  return (
    <>
      <h1 className={styles.stepTitle}>{t('onboarding.connection.title')}</h1>
      <p className={styles.stepSubtitle}>{t('onboarding.connection.subtitle')}</p>

      <div className={styles.field}>
        <label className={styles.label}>{t('onboarding.connection.gatewayLabel')}</label>
        <input
          className={styles.input}
          type="text"
          value={gatewayWsUrl}
          onChange={e => { onGatewayChange(e.target.value); setTestResult(null) }}
          placeholder={t('onboarding.connection.gatewayPlaceholder')}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('onboarding.connection.tokenLabel')}</label>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type={showToken ? 'text' : 'password'}
            value={authToken}
            onChange={e => { onTokenChange(e.target.value); setTestResult(null) }}
            placeholder={t('onboarding.connection.tokenPlaceholder')}
          />
          <button className={styles.eyeButton} onClick={() => setShowToken(v => !v)}>
            {showToken ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className={styles.testRow}>
        <button
          className={styles.testBtn}
          onClick={handleTest}
          disabled={testing || !gatewayWsUrl || !authToken}
        >
          {testing ? t('onboarding.connection.testingBtn') : t('onboarding.connection.testBtn')}
        </button>
        {testResult && (
          <span className={`${styles.testResult} ${testResult.success ? styles.success : styles.error}`}>
            {testResult.message}
          </span>
        )}
      </div>

      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack}>{t('common.back')}</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!canProceed}>
          {t('common.next')}
        </button>
      </div>
    </>
  )
}
