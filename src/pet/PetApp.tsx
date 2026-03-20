import React, { useCallback, useEffect, useState } from 'react'
import { PetCanvas } from './PetCanvas'
import { Toolbar } from '../toolbar/Toolbar'
import { useBridge } from '../hooks/useBridge'
import type { Manifest } from './AnimationEngine'

export function PetApp(): React.ReactElement {
  useBridge()

  const [hasSprites, setHasSprites] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkSprites() {
      try {
        const resp = await fetch('./res/sprites/baiyuan/manifest.json')
        if (!resp.ok) { setHasSprites(false); return }
        const manifest = await resp.json() as Manifest
        const anyFrames = Object.values(manifest.animations).some(
          anim => Array.isArray(anim.frames) && anim.frames.length > 0
        )
        setHasSprites(anyFrames)
      } catch {
        setHasSprites(false)
      }
    }
    void checkSprites()
  }, [])

  const handleMouseEnter = useCallback(() => {
    window.electronAPI?.send('pet:mouse-enter')
  }, [])

  const handleMouseLeave = useCallback(() => {
    window.electronAPI?.send('pet:mouse-leave')
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200, height: 240 }}>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {hasSprites === false ? (
          <div style={{
            width: 200,
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed rgba(255,255,255,0.5)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.12)',
            boxSizing: 'border-box',
            flexDirection: 'column',
            gap: 8,
          }}>
            <span style={{ fontSize: 28 }}>🌸</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '0 12px' }}>
              等待角色立绘...
            </span>
          </div>
        ) : (
          // Render canvas while checking (null) or when sprites confirmed (true)
          <PetCanvas />
        )}
      </div>
      <Toolbar onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
    </div>
  )
}
