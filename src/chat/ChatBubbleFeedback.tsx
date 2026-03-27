import React, { useCallback, useEffect, useRef, useState } from 'react'
import { parseBubbleText } from '../utils/bubbleParser'
import styles from './chat.module.css'

type Phase = 'idle' | 'waiting' | 'streaming' | 'displayed'

interface BubbleContentProps {
  text: string
}

function BubbleContent({ text }: BubbleContentProps): React.ReactElement {
  const segments = parseBubbleText(text)
  return (
    <div className={styles.bubbleText}>
      {segments.map((seg, i) => {
        if (seg.type === 'action') return <span key={i} className={styles.bubbleAction}>{seg.text}</span>
        if (seg.type === 'dialogue') return <span key={i} className={styles.bubbleDialogue}>{seg.text}</span>
        return <span key={i}>{seg.text}</span>
      })}
    </div>
  )
}

// Props kept for backward compatibility but no longer used — bubble subscribes to IPC directly
interface ChatBubbleFeedbackProps {
  message?: string | null
  onDismiss?: () => void
}

export function ChatBubbleFeedback(_props: ChatBubbleFeedbackProps): React.ReactElement | null {
  const [phase, setPhase] = useState<Phase>('idle')
  const [fullText, setFullText] = useState('')
  const [displayText, setDisplayText] = useState('')
  const isMouseOver = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typewriterIndex = useRef(0)
  const currentRunId = useRef('')
  const phaseRef = useRef<Phase>('idle')
  const fullTextRef = useRef('')

  // Keep refs in sync with state
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { fullTextRef.current = fullText }, [fullText])

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
  }, [])

  const clearTypewriter = useCallback(() => {
    if (typewriterTimer.current) {
      clearTimeout(typewriterTimer.current)
      typewriterTimer.current = null
    }
  }, [])

  const startDismissTimer = useCallback(() => {
    if (isMouseOver.current) return
    clearDismissTimer()
    dismissTimer.current = setTimeout(() => {
      setPhase('idle')
    }, 20000)
  }, [clearDismissTimer])

  // Typewriter: advance one character at a time
  const scheduleTypewriter = useCallback(() => {
    clearTypewriter()
    typewriterTimer.current = setTimeout(() => {
      const idx = typewriterIndex.current
      const text = fullTextRef.current
      if (idx < text.length) {
        typewriterIndex.current = idx + 1
        setDisplayText(text.slice(0, typewriterIndex.current))
        // Continue if more chars to show
        if (typewriterIndex.current < text.length) {
          scheduleTypewriter()
        } else if (phaseRef.current === 'streaming') {
          // Caught up — wait for more deltas
        } else {
          // Was 'displayed' phase (final received before typewriter finished) — done
          startDismissTimer()
        }
      }
    }, 30)
  }, [clearTypewriter, startDismissTimer])

  // IPC listeners
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const onAck = (data: { runId: string }) => {
      console.log('[Bubble] onAck', data.runId)
      currentRunId.current = data.runId
      phaseRef.current = 'waiting'
      setPhase('waiting')
      setFullText('')
      setDisplayText('')
      fullTextRef.current = ''
      typewriterIndex.current = 0
      clearDismissTimer()
      clearTypewriter()
    }

    const onDelta = (data: { runId: string; text: string }) => {
      if (currentRunId.current && data.runId !== currentRunId.current) {
        if (phaseRef.current === 'idle' || phaseRef.current === 'displayed') {
          // New message started without ACK — reset for new run
          console.log('[Bubble] onDelta: new run detected, resetting from', currentRunId.current, 'to', data.runId)
          currentRunId.current = ''
          typewriterIndex.current = 0
          clearTypewriter()
          clearDismissTimer()
        } else {
          console.log('[Bubble] onDelta: runId mismatch, dropping (active run:', currentRunId.current, 'got:', data.runId, ')')
          return
        }
      }
      if (!currentRunId.current) currentRunId.current = data.runId
      console.log('[Bubble] onDelta', data.runId, 'text length:', data.text.length)
      fullTextRef.current = data.text
      setFullText(data.text)
      if (phaseRef.current === 'waiting') {
        phaseRef.current = 'streaming'
        setPhase('streaming')
      } else if (phaseRef.current === 'idle' || phaseRef.current === 'displayed') {
        phaseRef.current = 'streaming'
        setPhase('streaming')
      }
      // Kick typewriter if it has caught up
      if (typewriterIndex.current < data.text.length && !typewriterTimer.current) {
        scheduleTypewriter()
      }
    }

    const onFinal = (data: { runId: string; text: string }) => {
      if (currentRunId.current && data.runId !== currentRunId.current) {
        if (phaseRef.current === 'idle' || phaseRef.current === 'displayed') {
          // New message started without ACK — reset for new run
          console.log('[Bubble] onFinal: new run detected, resetting from', currentRunId.current, 'to', data.runId)
          currentRunId.current = ''
          typewriterIndex.current = 0
          clearTypewriter()
          clearDismissTimer()
        } else {
          console.log('[Bubble] onFinal: runId mismatch, dropping (active run:', currentRunId.current, 'got:', data.runId, ')')
          return
        }
      }
      if (!currentRunId.current) currentRunId.current = data.runId
      console.log('[Bubble] onFinal', data.runId, 'text length:', data.text.length)
      fullTextRef.current = data.text
      setFullText(data.text)
      phaseRef.current = 'displayed'
      setPhase('displayed')
      if (typewriterIndex.current >= data.text.length) {
        startDismissTimer()
      } else if (!typewriterTimer.current) {
        scheduleTypewriter()
      }
    }

    const offAck = api.on('chat:ack', (...args: unknown[]) => onAck(args[0] as { runId: string }))
    const offDelta = api.on('chat:delta', (...args: unknown[]) => onDelta(args[0] as { runId: string; text: string }))
    const offFinal = api.on('chat:final', (...args: unknown[]) => onFinal(args[0] as { runId: string; text: string }))

    return () => { offAck(); offDelta(); offFinal() }
  }, [clearDismissTimer, clearTypewriter, scheduleTypewriter, startDismissTimer])

  const handleMouseEnter = useCallback(() => {
    isMouseOver.current = true
    clearDismissTimer()
  }, [clearDismissTimer])

  const handleMouseLeave = useCallback(() => {
    isMouseOver.current = false
    if (phaseRef.current === 'displayed') startDismissTimer()
  }, [startDismissTimer])

  const handleClick = useCallback(() => {
    setPhase('idle')
    clearDismissTimer()
    clearTypewriter()
  }, [clearDismissTimer, clearTypewriter])

  if (phase === 'idle') return null

  return (
    <div
      className={`${styles.chatBubble} ${styles.chatBubbleVisible}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {phase === 'waiting' && (
        <span className={styles.bubbleWaitingDots}>
          <span>·</span><span>·</span><span>·</span>
        </span>
      )}
      {(phase === 'streaming' || phase === 'displayed') && displayText && (
        <BubbleContent text={displayText} />
      )}
    </div>
  )
}
