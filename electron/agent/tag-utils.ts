const EMOTION_TAG_RE = /\[emotion:\s*(\w+)\]\s*$/
const VALID_EMOTIONS = ['happy', 'intimate', 'concerned', 'sad', 'playful', 'protective', 'cooking', 'talk']

export function extractEmotionFromResponse(text: string): string | null {
  const match = text.match(EMOTION_TAG_RE)
  if (!match) return null
  const val = match[1].toLowerCase()
  return VALID_EMOTIONS.includes(val) ? val : null
}
