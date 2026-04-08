import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './onboarding.module.css'

interface ConnectionStepProps {
  baseUrl: string
  apiKey: string
  model: string
  onBaseUrlChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  onModelChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

export function ConnectionStep({
  baseUrl,
  apiKey,
  model,
  onBaseUrlChange,
  onApiKeyChange,
  onModelChange,
  onNext,
  onBack,
}: ConnectionStepProps): React.ReactElement {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.electronAPI?.invoke('agent:test-connection', {
        baseUrl,
        apiKey,
        model,
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
  }, [baseUrl, apiKey, model, t])

  const canProceed = testResult?.success === true

  return (
    <>
      <h1 className={styles.stepTitle}>{t('onboarding.connection.title')}</h1>
      <p className={styles.stepSubtitle}>{t('onboarding.connection.subtitle')}</p>

      <div className={styles.field}>
        <label className={styles.label}>API 地址</label>
        <input
          className={styles.input}
          type="text"
          value={baseUrl}
          onChange={e => { onBaseUrlChange(e.target.value); setTestResult(null) }}
          placeholder="https://api.example.com"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>API 密钥</label>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => { onApiKeyChange(e.target.value); setTestResult(null) }}
            placeholder={t('onboarding.connection.tokenPlaceholder')}
          />
          <button className={styles.eyeButton} onClick={() => setShowKey(v => !v)}>
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>模型名称</label>
        <input
          className={styles.input}
          type="text"
          value={model}
          onChange={e => { onModelChange(e.target.value); setTestResult(null) }}
          placeholder="MiniMax-M2"
        />
      </div>

      <div className={styles.testRow}>
        <button
          className={styles.testBtn}
          onClick={handleTest}
          disabled={testing || !baseUrl || !apiKey || !model}
        >
          {testing ? t('onboarding.connection.testingBtn') : t('onboarding.connection.testBtn')}
        </button>
        {testResult && (
          <span className={styles.testResult + ' ' + (testResult.success ? styles.success : styles.error)}>
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
