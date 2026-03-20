import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './onboarding.module.css'

const IDLE_VALUES = [15, 30, 60, 120]

interface CompanionStepProps {
  companionEnabled: boolean
  idleMinutes: number
  onToggle: (v: boolean) => void
  onIdleChange: (v: number) => void
  onFinish: () => void
  onBack: () => void
}

export function CompanionStep({
  companionEnabled,
  idleMinutes,
  onToggle,
  onIdleChange,
  onFinish,
  onBack,
}: CompanionStepProps): React.ReactElement {
  const { t } = useTranslation()

  function idleLabel(minutes: number): string {
    if (minutes < 60) return t('onboarding.companion.minutesCount', { count: minutes })
    return t('onboarding.companion.hourCount', { count: minutes / 60 })
  }

  const currentIndex = IDLE_VALUES.findIndex(v => v >= idleMinutes)
  const sliderIndex = currentIndex === -1 ? IDLE_VALUES.length - 1 : currentIndex

  return (
    <>
      <h1 className={styles.stepTitle}>{t('onboarding.companion.title')}</h1>
      <p className={styles.stepSubtitle}>{t('onboarding.companion.subtitle')}</p>

      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>{t('onboarding.companion.enable')}</span>
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
          <span className={styles.label}>{t('onboarding.companion.idleInterval')}</span>
          <input
            type="range"
            className={styles.sliderInput}
            min={0}
            max={IDLE_VALUES.length - 1}
            value={sliderIndex}
            onChange={e => onIdleChange(IDLE_VALUES[Number(e.target.value)])}
          />
          <div className={styles.sliderLabels}>
            {IDLE_VALUES.map(v => <span key={v}>{idleLabel(v)}</span>)}
          </div>
        </div>
      )}

      {companionEnabled && (
        <p className={styles.warning}>{t('onboarding.companion.warning')}</p>
      )}

      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack}>{t('common.back')}</button>
        <button className={styles.btnPrimary} onClick={onFinish}>
          {t('onboarding.companion.finish')}
        </button>
      </div>
    </>
  )
}
