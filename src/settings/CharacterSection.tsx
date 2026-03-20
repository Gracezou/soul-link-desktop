import React from 'react'
import styles from './settings.module.css'

interface Props {
  settings: Record<string, unknown> | null
}

export function CharacterSection({ settings }: Props): React.ReactElement {
  const pet = settings?.pet as Record<string, unknown> | undefined
  const currentChar = String(pet?.character ?? 'baiyuan')

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>角色</h3>

      <div className={styles.field}>
        <span className={styles.label}>当前角色</span>
        <span className={styles.value}>{currentChar}</span>
      </div>

      <p className={styles.hint}>
        多角色切换功能正在开发中（MVP 后续版本）。
        当前固定使用「柏源」角色卡。
      </p>
    </div>
  )
}
