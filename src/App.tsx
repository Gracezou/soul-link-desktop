import React, { useEffect, useState } from 'react'
import { ChatWindow } from './chat/ChatWindow'
import { SettingsPanel } from './settings/SettingsPanel'
import { OnboardingWizard } from './onboarding/OnboardingWizard'
import { useBridge } from './hooks/useBridge'

const page = new URLSearchParams(window.location.search).get('page')

function App(): React.ReactElement {
  useBridge()

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const settings = await window.electronAPI?.invoke('settings:get') as {
          onboarding?: { completed?: boolean }
        } | undefined
        setOnboardingDone(settings?.onboarding?.completed === true)
      } catch {
        setOnboardingDone(true) // fail open
      }
    }
    void checkOnboarding()
  }, [])

  function handleClose(): void {
    window.electronAPI?.send('window:close')
  }

  if (page === 'settings') {
    return <SettingsPanel />
  }

  // Wait until we know onboarding status
  if (onboardingDone === null) {
    return <div style={{ height: '100vh', background: '#fdf6f0' }} />
  }

  if (!onboardingDone) {
    return (
      <OnboardingWizard
        onComplete={() => setOnboardingDone(true)}
      />
    )
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 100,
          background: 'transparent',
          border: 'none',
          color: '#888',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
        }}
        title="关闭"
      >
        ✕
      </button>
      <ChatWindow />
    </div>
  )
}

export default App
