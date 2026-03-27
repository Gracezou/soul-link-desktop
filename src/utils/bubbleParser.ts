interface TextSegment {
  type: 'action' | 'dialogue' | 'text'
  text: string
}

export function parseBubbleText(raw: string): TextSegment[] {
  const segments: TextSegment[] = []
  const pattern = /(\*[^*]+\*)|(\u201c[^\u201d]*\u201d)|("[^"]*")/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const before = raw.slice(lastIndex, match.index).trim()
      if (before) segments.push({ type: 'text', text: before })
    }

    const matched = match[0]
    if (matched.startsWith('*') && matched.endsWith('*')) {
      segments.push({ type: 'action', text: matched.slice(1, -1) })
    } else {
      segments.push({ type: 'dialogue', text: matched })
    }

    lastIndex = match.index + matched.length
  }

  if (lastIndex < raw.length) {
    const remaining = raw.slice(lastIndex).trim()
    if (remaining) segments.push({ type: 'text', text: remaining })
  }

  console.log('[BubbleParser] input:', raw.slice(0, 80), '-> segments:', segments.length)
  return segments
}
