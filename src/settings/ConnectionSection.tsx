import React, { useState, useEffect } from 'react'
import styles from './settings.module.css'

interface Props {
  settings: Record<string, unknown> | null
}

export function ConnectionSection({ settings }: Props): React.ReactElement {
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
    setTestResult('已保存')
    setTimeout(() => setTestResult(null), 2000)
  }

  async function handleTest(): Promise<void> {
    setTestResult('测试中…')
    try {
      const result = await window.electronAPI?.invoke('bridge:test-connection', {
        url, token,
      })
      setTestResult(result ? '连接成功 ✓' : '连接失败 ✗')
    } catch {
      setTestResult('连接失败 ✗')
    }
    setTimeout(() => setTestResult(null), 3000)
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>OpenClaw 网关</h3>

      <label className={styles.field}>
        <span className={styles.label}>网关地址</span>
        <input
          className={styles.input}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="ws://..."
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Token</span>
        <input
          className={styles.input}
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Gateway auth token"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Session Key</span>
        <input
          className={styles.input}
          value={sessionKey}
          onChange={e => setSessionKey(e.target.value)}
          placeholder="dyberpet-default"
        />
      </label>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={() => void handleTest()}>
          测试连接
        </button>
        <button className={styles.btnPrimary} onClick={() => void handleSave()}>
          保存
        </button>
      </div>

      {testResult && <p className={styles.testResult}>{testResult}</p>}
    </div>
  )
}
