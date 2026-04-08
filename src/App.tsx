import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatWindow } from './chat/ChatWindow'
import { ChatHistory } from './chat/ChatHistory'
import { SettingsPanel } from './settings/SettingsPanel'
import { OnboardingWizard } from './onboarding/OnboardingWizard'
import { PetApp } from './pet/PetApp'
import { useAgent } from './hooks/useAgent'
import { applyTheme } from './themes'

const page = new URLSearchParams(window.location.search).get('page')

// AgentApp calls useAgent and handles all pages that need the agent connection.
// ChatHistory runs in a separate window and does NOT need useBridge.
function AgentApp(): React.ReactElement {
  useAgent()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.invoke('settings:get').then((s) => {
      const ui = (s as { ui?: { language?: string; theme?: string } } | undefined)?.ui
      if (ui?.language && ui.language !== i18n.language) void i18n.changeLanguage(ui.language)
      applyTheme(ui?.theme ?? 'warm-pink')
    })

    const off = api.on('settings:changed', (...args: unknown[]) => {
      const theme = (args[0] as { ui?: { theme?: string } } | undefined)?.ui?.theme
      if (theme) applyTheme(theme)
    })

    return () => { off() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (page === 'pet') return <PetApp />
  if (page === 'settings') return <SettingsPanel />
  if (page === 'onboarding') return <OnboardingWizard />

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

function App(): React.ReactElement {
  if (page === 'history') return <ChatHistory />
  return <AgentApp />
}

export default App
