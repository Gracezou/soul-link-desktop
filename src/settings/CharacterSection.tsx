import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './settings.module.css'

interface Props {
  settings: Record<string, unknown> | null
}

export function CharacterSection({ settings }: Props): React.ReactElement {
  const { t } = useTranslation()
  const pet = settings?.pet as Record<string, unknown> | undefined
  const currentChar = String(pet?.character ?? 'baiyuan')

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('settings.character.title')}</h3>

      <div className={styles.field}>
        <span className={styles.label}>{t('settings.character.currentLabel')}</span>
        <span className={styles.value}>{currentChar}</span>
      </div>

      <p className={styles.hint}>{t('settings.character.hint')}</p>
    </div>
  )
}
