import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PetCanvas } from './PetCanvas'
import { Toolbar } from '../toolbar/Toolbar'
import { ChatBubbleFeedback } from '../chat/ChatBubbleFeedback'
import { CompactInput } from '../chat/CompactInput'
import type { Manifest } from './AnimationEngine'
import styles from './pet.module.css'

const SPRITE_HEIGHT = 256
const TOOLBAR_HEIGHT = 44
const PADDING = 16
const INPUT_PANEL_HEIGHT = 110
const BASE_HEIGHT = SPRITE_HEIGHT + TOOLBAR_HEIGHT + PADDING
const EXPANDED_HEIGHT = BASE_HEIGHT + INPUT_PANEL_HEIGHT

export function PetApp(): React.ReactElement {
  const { t } = useTranslation()
  const [hasSprites, setHasSprites] = useState<boolean | null>(null)
  const [hovered, setHovered] = useState(false)
  const [inputVisible, setInputVisible] = useState(false)
  const [currentMessage, setCurrentMessage] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

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

  // JS-based drag: track delta and send IPC to move window
  useEffect(() => {
    if (!dragging) return
    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.screenX - dragStart.current.x
      const deltaY = e.screenY - dragStart.current.y
      dragStart.current = { x: e.screenX, y: e.screenY }
      window.electronAPI?.send('pet:move-window', { deltaX, deltaY })
    }
    const onMouseUp = () => {
      setDragging(false)
      window.electronAPI?.send('pet:save-position')
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging])

  const onPetMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    dragStart.current = { x: e.screenX, y: e.screenY }
  }, [])

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    window.electronAPI?.send('pet:mouse-enter')
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    window.electronAPI?.send('pet:mouse-leave')
  }, [])

  const handleChatToggle = useCallback(() => {
    setInputVisible(prev => {
      const next = !prev
      window.electronAPI?.send('pet:resize-window', {
        height: next ? EXPANDED_HEIGHT : BASE_HEIGHT,
      })
      return next
    })
  }, [])

  const handleSend = useCallback((message: string) => {
    void window.electronAPI?.invoke('bridge:send', { message })
  }, [])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200, overflow: 'hidden' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={styles.dragArea}
        style={{ position: 'relative', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onPetMouseDown}
      >
        <ChatBubbleFeedback
          message={currentMessage}
          onDismiss={() => setCurrentMessage(null)}
        />
        {hasSprites === false ? (
          <div style={{
            width: 200,
            height: SPRITE_HEIGHT,
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
      <Toolbar visible={hovered} onChatClick={handleChatToggle} />
      <CompactInput visible={inputVisible} onSend={handleSend} />
    </div>
  )
}
