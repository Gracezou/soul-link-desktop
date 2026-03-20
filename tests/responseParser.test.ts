import { parseResponse } from '../src/utils/responseParser'

describe('parseResponse', () => {
  it('extracts actions from *...* patterns', () => {
    const result = parseResponse('*微笑着看向你* 「你好啊」')
    expect(result.actions).toContain('微笑着看向你')
    expect(result.dialogues).toContain('你好啊')
  })

  it('detects happy emotion', () => {
    const result = parseResponse('*开心地笑了* 「真好！」')
    expect(result.emotions).toContain('happy')
  })

  it('detects intimate emotion', () => {
    const result = parseResponse('*靠近你* 「嗯」')
    expect(result.emotions).toContain('intimate')
  })

  it('defaults to talk when no emotion detected', () => {
    const result = parseResponse('「嗯，我知道了」')
    expect(result.emotions).toContain('talk')
  })

  it('extracts MEDIA urls and removes from display text', () => {
    const text = '「你好」\nMEDIA:https://example.com/image.png'
    const result = parseResponse(text)
    expect(result.mediaUrls).toContain('https://example.com/image.png')
    expect(result.displayText).not.toContain('MEDIA:')
  })

  it('extracts 「...」 style dialogues', () => {
    const result = parseResponse('*低头* 「没事的」')
    expect(result.dialogues).toContain('没事的')
  })
})
