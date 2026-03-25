import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './chat.module.css'

interface PresetButtonsProps {
  onFill: (text: string) => void
}

const PRESETS = ['greeting', 'miss', 'whatsDoing'] as const

export function PresetButtons({ onFill }: PresetButtonsProps): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div className={styles.presetRow}>
      {PRESETS.map(key => (
        <button
          key={key}
          className={styles.presetButton}
          onClick={() => onFill(t(`chat.presets.${key}`))}
        >
          {t(`chat.presets.${key}`)}
        </button>
      ))}
    </div>
  )
}
