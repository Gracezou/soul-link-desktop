import { checkOutOfCharacter } from '../src/utils/oocDetector'

describe('checkOutOfCharacter', () => {
  describe('Chinese OOC patterns', () => {
    it('detects "我是AI助手"', () => {
      expect(checkOutOfCharacter('我是一个AI助手，很高兴为你服务。').detected).toBe(true)
    })

    it('detects "作为AI"', () => {
      expect(checkOutOfCharacter('作为AI，我无法真正感受情感。').detected).toBe(true)
    })

    it('detects "我没有情感"', () => {
      expect(checkOutOfCharacter('我没有真实的情感。').detected).toBe(true)
    })

    it('detects "我只是程序"', () => {
      expect(checkOutOfCharacter('我只是一个程序。').detected).toBe(true)
    })

    it('detects "语言模型"', () => {
      expect(checkOutOfCharacter('作为语言模型，我需要说明。').detected).toBe(true)
    })

    it('detects "大模型"', () => {
      expect(checkOutOfCharacter('我是大模型生成的。').detected).toBe(true)
    })
  })

  describe('English OOC patterns', () => {
    it('detects "I am an AI"', () => {
      expect(checkOutOfCharacter("I'm an AI language model.").detected).toBe(true)
    })

    it('detects "as an assistant"', () => {
      expect(checkOutOfCharacter('as an AI assistant, I cannot do that.').detected).toBe(true)
    })

    it('detects "I don\'t have feelings"', () => {
      expect(checkOutOfCharacter("I don't actually have emotions.").detected).toBe(true)
    })

    it('detects "I am just a program"', () => {
      expect(checkOutOfCharacter("I'm just a program.").detected).toBe(true)
    })
  })

  describe('should NOT detect (false positives)', () => {
    it('character dialogue mentioning AI in context', () => {
      expect(checkOutOfCharacter('*柏源看着你手机上的AI新闻。* "这些AI技术发展真快。"').detected).toBe(false)
    })

    it('question about AI', () => {
      expect(checkOutOfCharacter('"你觉得AI会取代人类吗？"').detected).toBe(false)
    })

    it('normal character dialogue', () => {
      expect(checkOutOfCharacter('*柏源笑了笑。* "早上好。"').detected).toBe(false)
    })

    it('dialogue with emotion tag', () => {
      expect(checkOutOfCharacter('"今天天气真好。" [emotion:happy]').detected).toBe(false)
    })
  })

  it('returns matched pattern string', () => {
    const result = checkOutOfCharacter('我是一个AI助手。')
    expect(result.detected).toBe(true)
    expect(result.matchedPattern).toBeTruthy()
  })

  it('returns null pattern when not detected', () => {
    const result = checkOutOfCharacter('"你好。"')
    expect(result.detected).toBe(false)
    expect(result.matchedPattern).toBeNull()
  })
})
