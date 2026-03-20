import React, { useState, useCallback } from 'react'
import styles from './onboarding.module.css'

interface ConnectionStepProps {
  language: string
  gatewayWsUrl: string
  authToken: string
  onGatewayChange: (v: string) => void
  onTokenChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

export function ConnectionStep({
  language,
  gatewayWsUrl,
  authToken,
  onGatewayChange,
  onTokenChange,
  onNext,
  onBack,
}: ConnectionStepProps): React.ReactElement {
  const isCN = language === 'zh-CN'
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
        setTestResult({ success: true, message: isCN ? '✓ 连接成功' : '✓ Connected' })
      } else {
        setTestResult({ success: false, message: result?.error ?? (isCN ? '连接失败' : 'Connection failed') })
      }
    } catch {
      setTestResult({ success: false, message: isCN ? '连接出错' : 'Error' })
    } finally {
      setTesting(false)
    }
  }, [gatewayWsUrl, authToken, isCN])

  const canProceed = testResult?.success === true

  return (
    <>
      <h1 className={styles.stepTitle}>{isCN ? '连接 OpenClaw 网关' : 'Connect to OpenClaw'}</h1>
      <p className={styles.stepSubtitle}>{isCN ? '输入你的网关地址和鉴权令牌' : 'Enter your gateway URL and auth token'}</p>

      <div className={styles.field}>
        <label className={styles.label}>{isCN ? '网关地址' : 'Gateway URL'}</label>
        <input
          className={styles.input}
          type="text"
          value={gatewayWsUrl}
          onChange={e => { onGatewayChange(e.target.value); setTestResult(null) }}
          placeholder="ws://localhost:18789/"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{isCN ? 'Auth Token' : 'Auth Token'}</label>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type={showToken ? 'text' : 'password'}
            value={authToken}
            onChange={e => { onTokenChange(e.target.value); setTestResult(null) }}
            placeholder={isCN ? '粘贴你的令牌' : 'Paste your token'}
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
          {testing ? (isCN ? '测试中…' : 'Testing…') : (isCN ? '测试连接' : 'Test Connection')}
        </button>
        {testResult && (
          <span className={`${styles.testResult} ${testResult.success ? styles.success : styles.error}`}>
            {testResult.message}
          </span>
        )}
      </div>

      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack}>{isCN ? '上一步' : 'Back'}</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!canProceed}>
          {isCN ? '下一步' : 'Next'}
        </button>
      </div>
    </>
  )
}
