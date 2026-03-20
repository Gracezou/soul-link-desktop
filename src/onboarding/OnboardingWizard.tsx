import React, { useState } from 'react'
import { WelcomeStep } from './WelcomeStep'
import { ConnectionStep } from './ConnectionStep'
import { CharacterStep } from './CharacterStep'
import { CompanionStep } from './CompanionStep'
import styles from './onboarding.module.css'

interface OnboardingWizardProps {
  onComplete: () => void
}

const TOTAL_STEPS = 4

export function OnboardingWizard({ onComplete }: OnboardingWizardProps): React.ReactElement {
  const [step, setStep] = useState(0)

  // Collected settings
  const [language, setLanguage] = useState('zh-CN')
  const [gatewayWsUrl, setGatewayWsUrl] = useState('ws://localhost:18789/')
  const [authToken, setAuthToken] = useState('')
  const [selectedCard, setSelectedCard] = useState('baiyuan')
  const [companionEnabled, setCompanionEnabled] = useState(false)
  const [idleMinutes, setIdleMinutes] = useState(30)

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  async function handleFinish() {
    // Persist all settings
    await window.electronAPI?.invoke('settings:set', {
      openclaw: {
        gatewayWsUrl,
        authToken,
        defaultCard: selectedCard,
      },
      companion: {
        enabled: companionEnabled,
        idleMinutes,
      },
      pet: {
        character: selectedCard,
      },
      ui: {
        language,
      },
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
      },
    })
    onComplete()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Step indicator */}
        <div className={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === step ? styles.active : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <WelcomeStep
            language={language}
            onLanguageChange={setLanguage}
            onNext={next}
          />
        )}
        {step === 1 && (
          <ConnectionStep
            language={language}
            gatewayWsUrl={gatewayWsUrl}
            authToken={authToken}
            onGatewayChange={setGatewayWsUrl}
            onTokenChange={setAuthToken}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 2 && (
          <CharacterStep
            language={language}
            selectedCard={selectedCard}
            onSelect={setSelectedCard}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 3 && (
          <CompanionStep
            language={language}
            companionEnabled={companionEnabled}
            idleMinutes={idleMinutes}
            onToggle={setCompanionEnabled}
            onIdleChange={setIdleMinutes}
            onFinish={handleFinish}
            onBack={back}
          />
        )}
      </div>
    </div>
  )
}
