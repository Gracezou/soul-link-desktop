const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g
const EN_WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g
const NUMBER_RE = /\d+/g

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

function estimateNumberTokens(text: string): number {
  const numberMatches = text.match(NUMBER_RE) ?? []
  let total = 0

  for (const item of numberMatches) {
    total += Math.max(1, Math.ceil(item.length / 3))
  }

  return total
}

export function estimateTokens(text: string): number {
  if (!text || !text.trim()) {
    return 0
  }

  const cjkCount = countMatches(text, CJK_CHAR_RE)
  const englishWordCount = countMatches(text, EN_WORD_RE)
  const numberTokens = estimateNumberTokens(text)

  const remainder = text
    .replace(CJK_CHAR_RE, '')
    .replace(EN_WORD_RE, '')
    .replace(NUMBER_RE, '')

  const punctuationAndSpaceCount = remainder.length
  const punctuationTokens = Math.ceil(punctuationAndSpaceCount / 4)

  return (cjkCount * 2) + englishWordCount + numberTokens + punctuationTokens
}

export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0

  for (const message of messages) {
    total += estimateTokens(message.content) + 4
  }

  return total
}
