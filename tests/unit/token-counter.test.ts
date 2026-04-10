import { estimateTokens, estimateMessagesTokens } from '../../electron/agent/token-counter'

describe('estimateTokens', () => {
  test('empty string returns 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  test('whitespace-only returns 0', () => {
    expect(estimateTokens('   ')).toBe(0)
  })

  test('pure Chinese text', () => {
    const text = '柏源抬起头看着你' // 8 CJK chars → 8×2 = 16 tokens
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThanOrEqual(10)
    expect(tokens).toBeLessThanOrEqual(20)
  })

  test('pure English text', () => {
    const text = 'Good morning, how are you today?'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThanOrEqual(6)
    expect(tokens).toBeLessThanOrEqual(15)
  })

  test('mixed Chinese and English', () => {
    const text = '*柏源笑了笑。* "Good morning."'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
  })

  test('long text returns proportionally more tokens', () => {
    const short = '你好'
    const long = '你好'.repeat(100)
    expect(estimateTokens(long)).toBeGreaterThan(estimateTokens(short) * 50)
  })

  test('special characters and emojis', () => {
    const text = '早上好 👋 [emotion:happy]'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
  })

  test('numbers are counted', () => {
    const text = '12345'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('estimateMessagesTokens', () => {
  test('empty array returns 0', () => {
    expect(estimateMessagesTokens([])).toBe(0)
  })

  test('adds per-message overhead', () => {
    const single = estimateTokens('你好')
    const fromMessages = estimateMessagesTokens([{ role: 'user', content: '你好' }])
    // Each message adds 4 tokens overhead
    expect(fromMessages).toBe(single + 4)
  })

  test('sums multiple messages', () => {
    const messages = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ]
    const total = estimateMessagesTokens(messages)
    expect(total).toBeGreaterThan(estimateTokens('你好') + estimateTokens('你好！'))
  })
})
