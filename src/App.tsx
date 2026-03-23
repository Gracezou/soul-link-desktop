import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatWindow } from './chat/ChatWindow'
import { SettingsPanel } from './settings/SettingsPanel'
import { OnboardingWizard } from './onboarding/OnboardingWizard'
import { PetApp } from './pet/PetApp'
import { useBridge } from './hooks/useBridge'
import { applyTheme } from './themes'

const page = new URLSearchParams(window.location.search).get('page')

function App(): React.ReactElement {
  useBridge()
  const { t, i18n } = useTranslation()

  // Sync language and theme from persisted settings on startup
  useEffect(() => {
    window.electronAPI?.invoke('settings:get').then((s) => {
      const ui = (s as { ui?: { language?: string; theme?: string } } | undefined)?.ui
      if (ui?.language && ui.language !== i18n.language) void i18n.changeLanguage(ui.language)
      applyTheme(ui?.theme ?? 'warm-pink')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (page === 'pet') {
    return <PetApp />
  }

  if (page === 'settings') {
    return <SettingsPanel />
  }

  if (page === 'onboarding') {
    return <OnboardingWizard />
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <button
        onClick={() => window.electronAPI?.send('window:close')}
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
        title={t('common.close')}
      >
        ✕
      </button>
      <ChatWindow />
    </div>
  )
}

export default App
