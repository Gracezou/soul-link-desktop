const OOC_PATTERNS_ZH = [
  /我是(一个|一名)?(AI|人工智能|语言模型|聊天机器人|虚拟助手)/,
  /作为(AI|人工智能|语言模型)/,
  /我(没有|不具备)(真实的)?(情感|感情|意识|身体)/,
  /我只是(一个)?(程序|软件|工具)/,
  /我无法(真正地?)(感受|体验|拥有)/,
  /AI\s*助手/,
  /语言模型/,
  /大模型/,
  /作为.*模型/,
]

const OOC_PATTERNS_EN = [
  /I('m| am) an? (AI|artificial intelligence|language model|chatbot|virtual assistant)/i,
  /as an? (AI|language model|assistant)/i,
  /I (don't|do not|cannot) (actually |really )?(have|feel|experience) (real )?(emotions|feelings|consciousness)/i,
  /I('m| am) (just |only )?a (program|software|tool|model)/i,
]

export interface OOCResult {
  detected: boolean
  matchedPattern: string | null
}

export function checkOutOfCharacter(text: string): OOCResult {
  for (const pattern of [...OOC_PATTERNS_ZH, ...OOC_PATTERNS_EN]) {
    const match = text.match(pattern)
    if (match) {
      return { detected: true, matchedPattern: match[0] }
    }
  }
  return { detected: false, matchedPattern: null }
}
