import React from 'react'
import { ChatWindow } from './chat/ChatWindow'
import { useBridge } from './hooks/useBridge'

function App(): React.ReactElement {
  useBridge()

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <ChatWindow />
    </div>
  )
}

export default App
