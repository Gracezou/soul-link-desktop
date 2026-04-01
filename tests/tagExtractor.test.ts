import { extractEmotionTag, stripPartialTag } from '../src/utils/tagExtractor'

describe('extractEmotionTag', () => {
  it('extracts happy emotion', () => {
    expect(extractEmotionTag('*笑了笑。* "你好。" [emotion:happy]'))
      .toEqual({ cleanText: '*笑了笑。* "你好。"', emotion: 'happy' })
  })

  it('extracts talk emotion', () => {
    expect(extractEmotionTag('"走吧。" [emotion:talk]'))
      .toEqual({ cleanText: '"走吧。"', emotion: 'talk' })
  })

  it('extracts intimate emotion', () => {
    expect(extractEmotionTag('*靠近你。* "嗯。" [emotion:intimate]'))
      .toEqual({ cleanText: '*靠近你。* "嗯。"', emotion: 'intimate' })
  })

  it('handles all valid emotions', () => {
    const emotions = ['happy', 'intimate', 'concerned', 'sad', 'playful', 'protective', 'cooking', 'talk']
    for (const e of emotions) {
      const result = extractEmotionTag(`"test" [emotion:${e}]`)
      expect(result.emotion).toBe(e)
    }
  })

  it('handles missing tag', () => {
    expect(extractEmotionTag('*点了点头。* "嗯。"'))
      .toEqual({ cleanText: '*点了点头。* "嗯。"', emotion: null })
  })

  it('rejects invalid emotion', () => {
    expect(extractEmotionTag('"嗯。" [emotion:angry]'))
      .toEqual({ cleanText: '"嗯。"', emotion: null })
  })

  it('handles trailing newline', () => {
    expect(extractEmotionTag('"好的。" [emotion:happy]\n'))
      .toEqual({ cleanText: '"好的。"', emotion: 'happy' })
  })

  it('handles space after colon', () => {
    expect(extractEmotionTag('"好的。" [emotion: happy]'))
      .toEqual({ cleanText: '"好的。"', emotion: 'happy' })
  })

  it('preserves text without tag', () => {
    const text = '*柏源端着一碗汤走了过来。* "趁热喝。"'
    expect(extractEmotionTag(text).cleanText).toBe(text)
  })
})

describe('stripPartialTag', () => {
  it('strips complete tag', () => {
    expect(stripPartialTag('"你好。" [emotion:happy]')).toBe('"你好。"')
  })

  it('strips partial tag', () => {
    expect(stripPartialTag('"你好。" [emotion:ha')).toBe('"你好。"')
  })

  it('strips tag with just bracket', () => {
    expect(stripPartialTag('"你好。" [emotion:')).toBe('"你好。"')
  })

  it('preserves text without tag', () => {
    expect(stripPartialTag('"你好。"')).toBe('"你好。"')
  })

  it('handles empty string', () => {
    expect(stripPartialTag('')).toBe('')
  })
})
