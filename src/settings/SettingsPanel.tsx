import React, { useState, useEffect } from 'react'
import { ConnectionSection } from './ConnectionSection'
import { CharacterSection } from './CharacterSection'
import { CompanionSection } from './CompanionSection'
import { AboutSection } from './AboutSection'
import styles from './settings.module.css'

type Tab = 'connection' | 'character' | 'companion' | 'about'

export function SettingsPanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('connection')
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    window.electronAPI?.invoke('settings:get').then(s => {
      setSettings(s as Record<string, unknown>)
    })
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'connection', label: '连接' },
    { id: 'character', label: '角色' },
    { id: 'companion', label: '陪伴' },
    { id: 'about', label: '关于' },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Soul Link 设置</h2>
        <button
          className={styles.closeBtn}
          onClick={() => window.electronAPI?.send('window:close')}
        >
          ✕
        </button>
      </div>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'connection' && <ConnectionSection settings={settings} />}
        {activeTab === 'character' && <CharacterSection settings={settings} />}
        {activeTab === 'companion' && <CompanionSection settings={settings} />}
        {activeTab === 'about' && <AboutSection />}
      </div>
    </div>
  )
}
