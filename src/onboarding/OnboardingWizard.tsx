import React, { useEffect, useState } from 'react'
import { WelcomeStep } from './WelcomeStep'
import { applyTheme } from '../themes'
import { ConnectionStep } from './ConnectionStep'
import { CharacterStep } from './CharacterStep'
import { CompanionStep } from './CompanionStep'
import styles from './onboarding.module.css'

const TOTAL_STEPS = 4

export function OnboardingWizard(): React.ReactElement {
  const [step, setStep] = useState(0)

  const [language, setLanguage] = useState('zh-CN')
  const [theme, setTheme] = useState('warm-pink')

  // Apply default theme on mount
  useEffect(() => { applyTheme('warm-pink') }, [])
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('MiniMax-M2')
  const [selectedCard, setSelectedCard] = useState('baiyuan')
  const [companionEnabled, setCompanionEnabled] = useState(false)
  const [idleMinutes, setIdleMinutes] = useState(30)

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  async function handleFinish() {
    await window.electronAPI?.invoke('settings:set', {
      cpa: { baseUrl, apiKey, model },
      character: { cardName: selectedCard },
      companion: { enabled: companionEnabled, idleMinutes },
      pet: { character: selectedCard },
      ui: { language, theme },
      onboarding: { completed: true, completedAt: new Date().toISOString() },
    })
    window.electronAPI?.send('onboarding:complete')
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === step ? styles.active : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <WelcomeStep
            language={language}
            onLanguageChange={setLanguage}
            theme={theme}
            onThemeChange={setTheme}
            onNext={next}
          />
        )}
        {step === 1 && (
          <ConnectionStep
            baseUrl={baseUrl}
            apiKey={apiKey}
            model={model}
            onBaseUrlChange={setBaseUrl}
            onApiKeyChange={setApiKey}
            onModelChange={setModel}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 2 && (
          <CharacterStep
            selectedCard={selectedCard}
            onSelect={setSelectedCard}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 3 && (
          <CompanionStep
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
