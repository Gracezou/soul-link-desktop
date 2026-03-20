import React from 'react'
import { ChatWindow } from './chat/ChatWindow'
import { SettingsPanel } from './settings/SettingsPanel'
import { useBridge } from './hooks/useBridge'

const page = new URLSearchParams(window.location.search).get('page')

function App(): React.ReactElement {
  useBridge()

  function handleClose(): void {
    window.electronAPI?.send('window:close')
  }

  if (page === 'settings') {
    return <SettingsPanel />
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
