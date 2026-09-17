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
  const [loading, setLoading] = useState(true)

  const [language, setLanguage] = useState('zh-CN')
  const [theme, setTheme] = useState('warm-pink')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('MiniMax-M2')
  const [selectedCard, setSelectedCard] = useState('baiyuan')
  const [companionEnabled, setCompanionEnabled] = useState(false)
  const [idleMinutes, setIdleMinutes] = useState(30)
  const [prefilledPet, setPrefilledPet] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 1000)
    )
    Promise.race([
      window.electronAPI?.invoke('settings:get') ?? Promise.reject(new Error('no api')),
      timeout,
    ])
      .then((result) => {
        if (cancelled) return
        const settings = result as Record<string, unknown>
        const ui = settings?.ui as Record<string, unknown> | undefined
        const cpa = settings?.cpa as Record<string, unknown> | undefined
        const character = settings?.character as Record<string, unknown> | undefined
        const companion = settings?.companion as Record<string, unknown> | undefined
        const pet = settings?.pet as Record<string, unknown> | undefined

        const loadedTheme = String(ui?.theme ?? 'warm-pink')
        setLanguage(String(ui?.language ?? 'zh-CN'))
        setTheme(loadedTheme)
        applyTheme(loadedTheme)
        setBaseUrl(String(cpa?.baseUrl ?? ''))
        setApiKey(String(cpa?.apiKey ?? ''))
        setModel(String(cpa?.model ?? 'MiniMax-M2'))
        setSelectedCard(String(character?.cardName ?? 'baiyuan'))
        setCompanionEnabled(Boolean(companion?.enabled ?? false))
        setIdleMinutes(Number(companion?.idleMinutes ?? 30))
        if (pet) setPrefilledPet(pet)
      })
      .catch(() => {
        if (!cancelled) applyTheme('warm-pink')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  async function handleFinish() {
    await window.electronAPI?.invoke('settings:set', {
      cpa: { baseUrl, apiKey, model },
      character: { cardName: selectedCard },
      companion: { enabled: companionEnabled, idleMinutes },
      pet: { ...(prefilledPet ?? {}), character: selectedCard },
      ui: { language, theme },
      onboarding: { completed: true, completedAt: new Date().toISOString() },
    })
    window.electronAPI?.send('onboarding:complete')
  }

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>Loading... / 加载中...</div>
      </div>
    )
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
            onSkip={next}
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
