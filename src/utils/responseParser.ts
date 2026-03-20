export type Emotion =
  | 'happy'
  | 'intimate'
  | 'concerned'
  | 'sad'
  | 'playful'
  | 'protective'
  | 'cooking'
  | 'talk'

export interface ParsedResponse {
  actions: string[]
  dialogues: string[]
  emotions: Emotion[]
  mediaUrls: string[]
  /** Display text with MEDIA lines removed */
  displayText: string
  fullText: string
}

const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  happy: ['笑', '微笑', '眉眼舒展', '上扬', '开心', '高兴'],
  intimate: ['靠近', '拥抱', '牵手', '握住', '贴近', '亲'],
  concerned: ['皱眉', '担心', '叹气', '收紧', '不安'],
  sad: ['沉默', '低头', '叹息', '黯淡'],
  playful: ['歪头', '坏笑', '狡黠', '眨眼', '戏弄'],
  protective: ['挡在', '护住', '拉到身后', '果断'],
  cooking: ['厨房', '做饭', '端着', '热腾腾'],
  talk: [],
}

export function parseResponse(text: string): ParsedResponse {
  const mediaUrls: string[] = []
  const lines = text.split('\n')

  // Extract MEDIA: lines
  const nonMediaLines = lines.filter(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('MEDIA:')) {
      mediaUrls.push(trimmed.slice(6).trim())
      return false
    }
    return true
  })
  const displayText = nonMediaLines.join('\n').trim()

  // Extract actions: *...*
  const actions: string[] = []
  const actionRegex = /\*([^*]+)\*/g
  let match
  while ((match = actionRegex.exec(displayText)) !== null) {
    actions.push(match[1].trim())
  }

  // Extract dialogues: "..." or 「...」
  const dialogues: string[] = []
  const dialogueRegex = /"([^"]+)"|「([^」]+)」/g
  while ((match = dialogueRegex.exec(displayText)) !== null) {
    dialogues.push((match[1] || match[2]).trim())
  }

  // Detect emotions from action text
  const actionText = actions.join(' ')
  const emotions: Emotion[] = []
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
    if (emotion === 'talk') continue
    if (keywords.some(kw => actionText.includes(kw))) {
      emotions.push(emotion)
    }
  }
  if (emotions.length === 0) {
    emotions.push('talk')
  }

  return { actions, dialogues, emotions, mediaUrls, displayText, fullText: text }
}
