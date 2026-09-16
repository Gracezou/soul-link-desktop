const EMOTION_TAG_RE = /\[emotion:\s*(\w+)\]\s*$/
const THINKING_BLOCK_RE = /<(think(?:ing)?)\s*>[\s\S]*?<\/\1\s*>/gi
const UNCLOSED_THINKING_RE = /<(?:think|thinking)\s*>[\s\S]*$/i
const VALID_EMOTIONS = ['happy', 'intimate', 'concerned', 'sad', 'playful', 'protective', 'cooking', 'talk']

export function stripThinking(text: string): string {
  return text
    .replace(THINKING_BLOCK_RE, '')
    .replace(UNCLOSED_THINKING_RE, '')
}

export function extractEmotionFromResponse(text: string): string | null {
  const match = text.match(EMOTION_TAG_RE)
  if (!match) return null
  const val = match[1].toLowerCase()
  return VALID_EMOTIONS.includes(val) ? val : null
}
