import React from 'react'
import styles from './onboarding.module.css'

const IDLE_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 120, label: '2 小时' },
]

const IDLE_OPTIONS_EN = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hr' },
]

interface CompanionStepProps {
  language: string
  companionEnabled: boolean
  idleMinutes: number
  onToggle: (v: boolean) => void
  onIdleChange: (v: number) => void
  onFinish: () => void
  onBack: () => void
}

export function CompanionStep({
  language,
  companionEnabled,
  idleMinutes,
  onToggle,
  onIdleChange,
  onFinish,
  onBack,
}: CompanionStepProps): React.ReactElement {
  const isCN = language === 'zh-CN'
  const options = isCN ? IDLE_OPTIONS : IDLE_OPTIONS_EN
  const sliderIndex = options.findIndex(o => o.value >= idleMinutes)
  const currentIndex = sliderIndex === -1 ? options.length - 1 : sliderIndex

  return (
    <>
      <h1 className={styles.stepTitle}>{isCN ? '主动伴侣设置' : 'Companion Settings'}</h1>
      <p className={styles.stepSubtitle}>
        {isCN ? '空闲时让角色主动和你打招呼' : 'Let your companion reach out when you are idle'}
      </p>

      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>
          {isCN ? '启用待机主动对话' : 'Enable proactive companion'}
        </span>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={companionEnabled}
            onChange={e => onToggle(e.target.checked)}
          />
          <span className={styles.toggleSlider} />
        </label>
      </div>

      {companionEnabled && (
        <div className={styles.sliderRow}>
          <span className={styles.label}>{isCN ? '空闲触发间隔' : 'Idle trigger interval'}</span>
          <input
            type="range"
            className={styles.sliderInput}
            min={0}
            max={options.length - 1}
            value={currentIndex}
            onChange={e => onIdleChange(options[Number(e.target.value)].value)}
          />
          <div className={styles.sliderLabels}>
            {options.map(o => <span key={o.value}>{o.label}</span>)}
          </div>
        </div>
      )}

      {companionEnabled && (
        <p className={styles.warning}>
          {isCN
            ? '⚠️ 启用后角色会在空闲时主动与你对话，会产生少量 Token 消耗'
            : '⚠️ When enabled, your companion will initiate conversations during idle periods, consuming a small amount of tokens'}
        </p>
      )}

      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack}>{isCN ? '上一步' : 'Back'}</button>
        <button className={styles.btnPrimary} onClick={onFinish}>
          {isCN ? '完成设置 ✓' : 'Finish Setup ✓'}
        </button>
      </div>
    </>
  )
}
