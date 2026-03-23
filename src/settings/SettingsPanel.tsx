import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ConnectionSection } from './ConnectionSection'
import { CharacterSection } from './CharacterSection'
import { CompanionSection } from './CompanionSection'
import { AboutSection } from './AboutSection'
import { AppearanceSection } from './AppearanceSection'
import styles from './settings.module.css'

type Tab = 'connection' | 'character' | 'companion' | 'appearance' | 'about'

export function SettingsPanel(): React.ReactElement {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('connection')
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    window.electronAPI?.invoke('settings:get').then(s => {
      setSettings(s as Record<string, unknown>)
    })
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'connection', label: t('settings.tabs.connection') },
    { id: 'character', label: t('settings.tabs.character') },
    { id: 'companion', label: t('settings.tabs.companion') },
    { id: 'appearance', label: t('settings.tabs.appearance') },
    { id: 'about', label: t('settings.tabs.about') },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('settings.title')}</h2>
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
        {activeTab === 'appearance' && <AppearanceSection settings={settings} />}
        {activeTab === 'about' && <AboutSection />}
      </div>
    </div>
  )
}
