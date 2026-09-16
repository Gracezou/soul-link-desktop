const EMOTION_TAG_RE = /\[emotion:\s*(\w+)\]\s*$/
const THINKING_BLOCK_RE = /<(think(?:ing)?)\s*>[\s\S]*?<\/\1\s*>/gi
const UNCLOSED_THINKING_RE = /<(?:think|thinking)\s*>[\s\S]*$/i
const ORPHANED_THINKING_CLOSE_RE = /<\/(?:think|thinking)\s*>/gi
const VALID_EMOTIONS = ['happy', 'intimate', 'concerned', 'sad', 'playful', 'protective', 'cooking', 'talk']

export function stripThinking(text: string): string {
  const stripped = text
    .replace(THINKING_BLOCK_RE, '')
    .replace(UNCLOSED_THINKING_RE, '')

  let lastClosingTagEnd = -1
  for (const match of stripped.matchAll(ORPHANED_THINKING_CLOSE_RE)) {
    lastClosingTagEnd = match.index + match[0].length
  }

  return lastClosingTagEnd >= 0 ? stripped.slice(lastClosingTagEnd) : stripped
}

export function extractEmotionFromResponse(text: string): string | null {
  const match = text.match(EMOTION_TAG_RE)
  if (!match) return null
  const val = match[1].toLowerCase()
  return VALID_EMOTIONS.includes(val) ? val : null
}
