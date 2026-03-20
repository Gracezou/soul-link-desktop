import React, { useEffect, useRef, useCallback } from 'react'
import { SpriteSheet } from './SpriteSheet'
import { AnimationEngine } from './AnimationEngine'
import { usePetStore } from '../stores/petStore'
import type { Manifest } from './AnimationEngine'

// Manifest is loaded at runtime; use a placeholder during dev
const PLACEHOLDER_MANIFEST: Manifest = {
  character: 'baiyuan',
  defaultAnimation: 'idle',
  frameRate: 10,
  animations: {
    idle: { frames: [], loop: true, probability: 1, minFV: 0 },
    talk: { frames: [], loop: true, probability: 0, minFV: 0, trigger: 'on_message' },
  },
}

export function PetCanvas(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<AnimationEngine | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const animationName = usePetStore(s => s.animationName)
  const fvLevel = usePetStore(s => s.fvLevel)
  const setDragging = usePetStore(s => s.setDragging)

  // Load manifest and init engine
  useEffect(() => {
    async function init() {
      let manifest: Manifest = PLACEHOLDER_MANIFEST
      try {
        const resp = await fetch('./res/sprites/baiyuan/manifest.json')
        if (resp.ok) {
          manifest = await resp.json() as Manifest
        }
      } catch {
        console.warn('[PetCanvas] Could not load manifest, using placeholder')
      }

      const spriteSheet = new SpriteSheet('./res/sprites/baiyuan/frames')
      const engine = new AnimationEngine(manifest, spriteSheet)
      engineRef.current = engine

      try {
        await engine.preloadAll()
      } catch {
        console.warn('[PetCanvas] Some frames failed to preload')
      }
    }

    void init()
  }, [])

  // Sync animation name from store
  useEffect(() => {
    engineRef.current?.playAnimation(animationName)
  }, [animationName])

  // Sync FV level
  useEffect(() => {
    engineRef.current?.setFV(fvLevel)
  }, [fvLevel])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function loop(timestamp: number) {
      const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 0
      lastTimeRef.current = timestamp

      const engine = engineRef.current
      if (engine && ctx && canvas) {
        engine.update(delta)

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const frame = engine.currentFrame
        if (frame) {
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
        } else {
          // Placeholder: draw a simple circle when no sprites loaded
          ctx.fillStyle = 'rgba(200, 150, 100, 0.8)'
          ctx.beginPath()
          ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'white'
          ctx.font = '14px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('柏源', canvas.width / 2, canvas.height / 2 + 5)
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Drag handling
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
    window.electronAPI?.send('pet:drag-start', { x: e.clientX, y: e.clientY })
  }, [setDragging])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    window.electronAPI?.send('pet:drag-move', { x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    setDragging(false)
    window.electronAPI?.send('pet:drag-end')
  }, [setDragging])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      style={{ cursor: 'grab', display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  )
}
