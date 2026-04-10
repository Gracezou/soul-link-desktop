import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './settings.module.css'

interface Props {
  settings: Record<string, unknown> | null
}

export function ConnectionSection({ settings }: Props): React.ReactElement {
  const { t } = useTranslation()

  const [baseUrl, setBaseUrl] = useState(String((settings?.cpa as Record<string, unknown> | undefined)?.baseUrl ?? ''))
  const [apiKey, setApiKey] = useState(String((settings?.cpa as Record<string, unknown> | undefined)?.apiKey ?? ''))
  const [model, setModel] = useState(String((settings?.cpa as Record<string, unknown> | undefined)?.model ?? 'MiniMax-M2'))
  const [testResult, setTestResult] = useState<string | null>(null)
  const [needsRestart, setNeedsRestart] = useState(false)

  const initializedRef = useRef(false)
  useEffect(() => {
    if (!settings || initializedRef.current) return
    const cpaVal = settings.cpa as Record<string, unknown> | undefined
    setBaseUrl(String(cpaVal?.baseUrl ?? ''))
    setApiKey(String(cpaVal?.apiKey ?? ''))
    setModel(String(cpaVal?.model ?? 'MiniMax-M2'))
    initializedRef.current = true
  }, [settings])

  async function handleSave(): Promise<void> {
    const cpaVal = settings?.cpa as Record<string, unknown> | undefined
    const changed =
      baseUrl !== String(cpaVal?.baseUrl ?? '') ||
      apiKey !== String(cpaVal?.apiKey ?? '') ||
      model !== String(cpaVal?.model ?? 'MiniMax-M2')
    try {
      await window.electronAPI?.invoke('settings:set', { cpa: { baseUrl, apiKey, model } })
      setTestResult(t('settings.connection.saved'))
      if (changed) setNeedsRestart(true)
    } catch {
      setTestResult(t('settings.connection.testFailed'))
    }
    setTimeout(() => setTestResult(null), 2000)
  }

  async function handleTest(): Promise<void> {
    setTestResult(t('common.testing'))
    try {
      const result = await window.electronAPI?.invoke('agent:test-connection', {
        baseUrl, apiKey, model,
      }) as { success: boolean; error?: string } | undefined
      setTestResult(result?.success ? t('settings.connection.testSuccess') : (result?.error ?? t('settings.connection.testFailed')))
    } catch {
      setTestResult(t('settings.connection.testFailed'))
    }
    setTimeout(() => setTestResult(null), 3000)
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('settings.connection.title')}</h3>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.connection.baseUrlLabel')}</span>
        <input
          className={styles.input}
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.connection.apiKeyLabel')}</span>
        <input
          className={styles.input}
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={t('settings.connection.tokenPlaceholder')}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.connection.modelLabel')}</span>
        <input
          className={styles.input}
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder="MiniMax-M2"
        />
      </label>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={() => void handleTest()} disabled={!baseUrl || !apiKey || !model}>
          {t('settings.connection.testBtn')}
        </button>
        <button className={styles.btnPrimary} onClick={() => void handleSave()}>
          {t('common.save')}
        </button>
      </div>

      {testResult && !needsRestart && <p className={styles.testResult}>{testResult}</p>}

      {needsRestart && (
        <div className={styles.restartBanner}>
          <span className={styles.restartBannerText}>{t('settings.connection.restartRequired')}</span>
          <button className={styles.btnPrimary} onClick={() => window.electronAPI?.send('app:relaunch')}>
            {t('settings.connection.restartNow')}
          </button>
          <button className={styles.btnSecondary} onClick={() => setNeedsRestart(false)}>
            {t('settings.connection.restartLater')}
          </button>
        </div>
      )}
    </div>
  )
}
