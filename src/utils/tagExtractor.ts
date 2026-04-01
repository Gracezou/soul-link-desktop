const VALID_EMOTIONS = [
  'happy',
  'intimate',
  'concerned',
  'sad',
  'playful',
  'protective',
  'cooking',
  'talk',
] as const

export type EmotionTag = typeof VALID_EMOTIONS[number]

export interface TagExtractionResult {
  cleanText: string
  emotion: EmotionTag | null
}

const EMOTION_TAG_REGEX = /\[emotion:\s*(\w+)\]\s*$/

export function extractEmotionTag(rawText: string): TagExtractionResult {
  const match = rawText.match(EMOTION_TAG_REGEX)

  if (!match) {
    return { cleanText: rawText.trim(), emotion: null }
  }

  const emotionValue = match[1].toLowerCase()
  const emotion = VALID_EMOTIONS.includes(emotionValue as EmotionTag)
    ? (emotionValue as EmotionTag)
    : null

  const cleanText = rawText.replace(EMOTION_TAG_REGEX, '').trim()

  return { cleanText, emotion }
}

export function stripPartialTag(text: string): string {
  return text.replace(/\[emotion:\s*\w*\]?\s*$/, '').trim()
}
