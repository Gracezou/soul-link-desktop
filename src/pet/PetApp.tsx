import React, { useCallback } from 'react'
import { PetCanvas } from './PetCanvas'
import { Toolbar } from '../toolbar/Toolbar'
import { useBridge } from '../hooks/useBridge'

export function PetApp(): React.ReactElement {
  useBridge()

  const handleMouseEnter = useCallback(() => {
    window.electronAPI?.send('pet:mouse-enter')
  }, [])

  const handleMouseLeave = useCallback(() => {
    window.electronAPI?.send('pet:mouse-leave')
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200, height: 240 }}>
      <PetCanvas />
      <Toolbar onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
    </div>
  )
}
