import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './settings.module.css'

interface Props {
  settings: Record<string, unknown> | null
}

export function ConnectionSection({ settings }: Props): React.ReactElement {
  const { t } = useTranslation()
  const openclaw = settings?.openclaw as Record<string, unknown> | undefined

  const [url, setUrl] = useState(String(openclaw?.gatewayWsUrl ?? 'ws://188.239.18.173:4000/'))
  const [token, setToken] = useState(String(openclaw?.authToken ?? ''))
  const [sessionKey, setSessionKey] = useState(String(openclaw?.sessionKey ?? 'dyberpet-default'))
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (openclaw) {
      setUrl(String(openclaw.gatewayWsUrl ?? ''))
      setToken(String(openclaw.authToken ?? ''))
      setSessionKey(String(openclaw.sessionKey ?? ''))
    }
  }, [settings])

  async function handleSave(): Promise<void> {
    await window.electronAPI?.invoke('settings:set', {
      openclaw: { gatewayWsUrl: url, authToken: token, sessionKey },
    })
    setTestResult(t('settings.connection.saved'))
    setTimeout(() => setTestResult(null), 2000)
  }

  async function handleTest(): Promise<void> {
    setTestResult(t('common.testing'))
    try {
      const result = await window.electronAPI?.invoke('bridge:test-connection', {
        gatewayWsUrl: url, authToken: token,
      })
      setTestResult(result ? t('settings.connection.testSuccess') : t('settings.connection.testFailed'))
    } catch {
      setTestResult(t('settings.connection.testFailed'))
    }
    setTimeout(() => setTestResult(null), 3000)
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('settings.connection.title')}</h3>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.connection.gatewayLabel')}</span>
        <input
          className={styles.input}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="ws://..."
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.connection.tokenLabel')}</span>
        <input
          className={styles.input}
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder={t('settings.connection.tokenPlaceholder')}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.connection.sessionKeyLabel')}</span>
        <input
          className={styles.input}
          value={sessionKey}
          onChange={e => setSessionKey(e.target.value)}
          placeholder="dyberpet-default"
        />
      </label>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={() => void handleTest()}>
          {t('settings.connection.testBtn')}
        </button>
        <button className={styles.btnPrimary} onClick={() => void handleSave()}>
          {t('common.save')}
        </button>
      </div>

      {testResult && <p className={styles.testResult}>{testResult}</p>}
    </div>
  )
}
