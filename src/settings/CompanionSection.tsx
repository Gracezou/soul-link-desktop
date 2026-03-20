import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './settings.module.css'

type CompanionMode = 'balanced' | 'checkin' | 'question' | 'report'

interface Props {
  settings: Record<string, unknown> | null
}

export function CompanionSection({ settings }: Props): React.ReactElement {
  const { t } = useTranslation()
  const companion = settings?.companion as Record<string, unknown> | undefined

  const [enabled, setEnabled] = useState(Boolean(companion?.enabled ?? false))
  const [idleMinutes, setIdleMinutes] = useState(Number(companion?.idleMinutes ?? 30))
  const [mode, setMode] = useState<CompanionMode>((companion?.mode as CompanionMode) ?? 'balanced')

  useEffect(() => {
    if (companion) {
      setEnabled(Boolean(companion.enabled))
      setIdleMinutes(Number(companion.idleMinutes))
      setMode((companion.mode as CompanionMode) ?? 'balanced')
    }
  }, [settings])

  async function handleSave(): Promise<void> {
    await window.electronAPI?.invoke('settings:set', {
      companion: { enabled, idleMinutes, mode },
    })
  }

  const modeOptions: { value: CompanionMode; label: string }[] = [
    { value: 'balanced', label: t('settings.companion.mode.balanced') },
    { value: 'checkin', label: t('settings.companion.mode.checkin') },
    { value: 'question', label: t('settings.companion.mode.question') },
    { value: 'report', label: t('settings.companion.mode.report') },
  ]

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('settings.companion.title')}</h3>

      <label className={styles.fieldRow}>
        <span className={styles.label}>{t('settings.companion.enableLabel')}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.companion.idleLabel')}</span>
        <input
          className={styles.input}
          type="number"
          min={5}
          max={240}
          value={idleMinutes}
          onChange={e => setIdleMinutes(Number(e.target.value))}
          disabled={!enabled}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('settings.companion.styleLabel')}</span>
        <select
          className={styles.select}
          value={mode}
          onChange={e => setMode(e.target.value as CompanionMode)}
          disabled={!enabled}
        >
          {modeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={() => void handleSave()}>
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
