import { isSystemMessage } from './systemFilter'
import { checkOutOfCharacter } from './oocDetector'
import { extractEmotionTag, type EmotionTag } from './tagExtractor'

export interface FilterResult {
  displayText: string
  emotion: EmotionTag | null
  shouldAnimate: boolean
  rawText: string
  oocDetected: boolean
}

export function processResponse(rawText: string): FilterResult | null {
  if (isSystemMessage(rawText)) {
    console.log('[ProtocolFilter] system message suppressed:', rawText.slice(0, 60))
    return null
  }

  const oocResult = checkOutOfCharacter(rawText)
  if (oocResult.detected) {
    console.log('[ProtocolFilter] OOC detected:', oocResult.matchedPattern)
  }

  const { cleanText, emotion } = extractEmotionTag(rawText)
  if (emotion) {
    console.log('[ProtocolFilter] emotion extracted:', emotion)
  }

  return {
    displayText: cleanText,
    emotion,
    shouldAnimate: emotion !== null,
    rawText,
    oocDetected: oocResult.detected,
  }
}
