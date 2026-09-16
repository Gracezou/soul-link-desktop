import { stripThinking } from '../../electron/agent/tag-utils'

describe('stripThinking', () => {
  test('removes a complete think block', () => {
    expect(stripThinking('<think>internal reasoning</think>answer')).toBe('answer')
  })

  test('removes a multiline thinking block', () => {
    expect(stripThinking('<thinking>first line\nsecond line</thinking>answer')).toBe('answer')
  })

  test.each([
    '<think>unfinished reasoning',
    '<thinking>unfinished reasoning',
  ])('returns an empty string for an unclosed thinking block: %s', (text) => {
    expect(stripThinking(text)).toBe('')
  })

  test.each([
    'before<think>unfinished reasoning',
    'before<Thinking>unfinished reasoning',
  ])('preserves visible text before an unclosed thinking block: %s', (text) => {
    expect(stripThinking(text)).toBe('before')
  })

  test('returns text without thinking tags unchanged', () => {
    const text = '  ordinary response\nwith preserved whitespace  '

    expect(stripThinking(text)).toBe(text)
  })

  test('preserves text before and after a thinking block', () => {
    expect(stripThinking('before<think>internal</think>after')).toBe('beforeafter')
  })

  test('removes multiple thinking blocks', () => {
    expect(stripThinking('<think>one</think>A<thinking>two</thinking>B')).toBe('AB')
  })

  test('matches tags case-insensitively', () => {
    expect(stripThinking('<ThInKiNg>internal</tHiNkInG>answer')).toBe('answer')
  })

  test.each([
    ['internal reasoning</think>answer', 'answer'],
    ['first</think>middle</THINKING>answer', 'answer'],
  ])('removes content through the last orphaned closing tag: %s', (text, expected) => {
    expect(stripThinking(text)).toBe(expected)
  })
})
