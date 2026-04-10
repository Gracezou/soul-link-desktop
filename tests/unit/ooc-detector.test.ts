import { checkOutOfCharacter } from '../../electron/agent/ooc-detector'

describe('checkOutOfCharacter', () => {
  describe('should detect OOC (Chinese)', () => {
    const oocTexts = [
      '我是一个AI助手，很高兴为你服务。',
      '作为AI，我无法真正感受情感。',
      '我是一个语言模型，不具备真实的感情。',
      '我只是一个程序，无法理解人类的感受。',
      '作为大模型，我可以帮你解答问题。',
    ]

    oocTexts.forEach((text) => {
      test(`detects: "${text.slice(0, 30)}..."`, () => {
        const result = checkOutOfCharacter(text)
        expect(result.detected).toBe(true)
        expect(result.matchedPattern).toBeTruthy()
      })
    })
  })

  describe('should detect OOC (English)', () => {
    const oocTexts = [
      "I'm an AI language model, I can help you.",
      "As an artificial intelligence, I don't have feelings.",
      "I am just a program designed to assist you.",
    ]

    oocTexts.forEach((text) => {
      test(`detects: "${text.slice(0, 40)}..."`, () => {
        const result = checkOutOfCharacter(text)
        expect(result.detected).toBe(true)
        expect(result.matchedPattern).toBeTruthy()
      })
    })
  })

  describe('should NOT detect OOC (valid character dialogue)', () => {
    const validTexts = [
      '*柏源笑了笑。* "早上好，睡好了吗？"',
      '*他看着你手机上的AI新闻。* "这些AI技术发展真快。"',
      '"你觉得AI会取代人类吗？" *柏源思考了一下。*',
      '*柏源端着咖啡走过来。* "今天你看起来心情不错。"',
      '"我给你做了你喜欢的三明治。"',
      '*他揉了揉你的头。* "别想太多了。"',
    ]

    validTexts.forEach((text) => {
      test(`passes: "${text.slice(0, 30)}..."`, () => {
        const result = checkOutOfCharacter(text)
        expect(result.detected).toBe(false)
        expect(result.matchedPattern).toBeNull()
      })
    })
  })
})
