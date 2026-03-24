import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PetCanvas } from './PetCanvas'
import { Toolbar } from '../toolbar/Toolbar'
import { ChatBubbleFeedback } from '../chat/ChatBubbleFeedback'
import { CompactInput } from '../chat/CompactInput'
import type { Manifest } from './AnimationEngine'
import styles from './pet.module.css'

export function PetApp(): React.ReactElement {
  const { t } = useTranslation()
  const [hasSprites, setHasSprites] = useState<boolean | null>(null)
  const [hovered, setHovered] = useState(false)
  const [inputVisible, setInputVisible] = useState(false)
  const [currentMessage, setCurrentMessage] = useState<string | null>(null)

  useEffect(() => {
    async function checkSprites() {
      try {
        const resp = await fetch('res://sprites/baiyuan/manifest.json')
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

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const handler = (...args: unknown[]) => {
      const data = args[0] as { text: string }
      setCurrentMessage(data.text)
    }
    const off = api.on('bridge:message', handler)
    return () => { off() }
  }, [])

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    window.electronAPI?.send('pet:mouse-enter')
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    window.electronAPI?.send('pet:mouse-leave')
  }, [])

  const handleSend = useCallback((message: string) => {
    void window.electronAPI?.invoke('bridge:send', { message })
  }, [])

  const handleOpenHistory = useCallback(() => {
    void window.electronAPI?.invoke('window:open-history')
  }, [])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.dragArea} style={{ position: 'relative' }}>
        <ChatBubbleFeedback
          message={currentMessage}
          onDismiss={() => setCurrentMessage(null)}
        />
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
              {t('pet.placeholder')}
            </span>
          </div>
        ) : (
          <PetCanvas />
        )}
      </div>
      <Toolbar visible={hovered} onChatClick={() => setInputVisible(prev => !prev)} />
      <CompactInput
        visible={inputVisible}
        onSend={handleSend}
        onOpenHistory={handleOpenHistory}
      />
    </div>
  )
}
