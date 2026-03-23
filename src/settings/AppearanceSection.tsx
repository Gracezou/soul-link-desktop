import React from 'react'
import { useTranslation } from 'react-i18next'
import { getThemeList, applyTheme } from '../themes'
import type { ThemeName } from '../themes'
import styles from './settings.module.css'

interface AppearanceSectionProps {
  settings: Record<string, unknown> | null
}

export function AppearanceSection({ settings }: AppearanceSectionProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const currentUi = (settings as { ui?: Record<string, unknown> } | null)?.ui ?? {}
  const currentTheme = (currentUi.theme as ThemeName | undefined) ?? 'warm-pink'
  const themeList = getThemeList()

  async function handleThemeChange(name: ThemeName): Promise<void> {
    applyTheme(name)
    await window.electronAPI?.invoke('settings:set', { ui: { ...currentUi, theme: name } })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('settings.appearance.title')}</h3>
      <div className={styles.field}>
        <span className={styles.label}>{t('settings.appearance.themeLabel')}</span>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {themeList.map(theme => (
            <button
              key={theme.name}
              onClick={() => void handleThemeChange(theme.name)}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 10,
                border: `1.5px solid ${currentTheme === theme.name ? 'var(--primary)' : 'var(--divider)'}`,
                background: currentTheme === theme.name ? 'var(--primary-soft)' : 'var(--bg-secondary)',
                color: currentTheme === theme.name ? 'var(--primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: currentTheme === theme.name ? 600 : 400,
                fontSize: 13,
                transition: 'all 0.15s',
              }}
            >
              {i18n.language === 'zh-CN' ? theme.label : theme.labelEn}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
