import React, { useState } from 'react'
import styles from './settings.module.css'

export function AboutSection(): React.ReactElement {
  const [resetting, setResetting] = useState(false)

  async function handleResetOnboarding(): Promise<void> {
    setResetting(true)
    await window.electronAPI?.invoke('settings:set', {
      onboarding: { completed: false },
    })
    // Relaunch app so main process shows onboarding window again
    window.electronAPI?.send('app:relaunch')
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>关于</h3>

      <div className={styles.field}>
        <span className={styles.label}>版本</span>
        <span className={styles.value}>Soul Link Desktop v0.1.0</span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>技术栈</span>
        <span className={styles.value}>Electron · React · TypeScript · OpenClaw</span>
      </div>

      <hr className={styles.divider} />

      <h3 className={styles.sectionTitle}>重置</h3>
      <p className={styles.hint}>重新运行初始引导流程，可用于重新配置连接和角色。</p>

      <div className={styles.actions}>
        <button
          className={styles.btnSecondary}
          onClick={() => void handleResetOnboarding()}
          disabled={resetting}
        >
          {resetting ? '重置中…' : '重新运行初始化引导'}
        </button>
      </div>
    </div>
  )
}
