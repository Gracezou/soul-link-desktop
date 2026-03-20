import { mapEmotionToAnimation } from '../src/utils/emotionMapper'
import { parseResponse } from '../src/utils/responseParser'

describe('mapEmotionToAnimation', () => {
  it('maps happy emotion to happy animation', () => {
    const parsed = parseResponse('*开心地笑了*')
    const cmd = mapEmotionToAnimation(parsed)
    expect(cmd.animationName).toBe('happy')
    expect(cmd.fvDelta).toBe(5)
  })

  it('maps intimate emotion to intimate animation', () => {
    const parsed = parseResponse('*轻轻拥抱*')
    const cmd = mapEmotionToAnimation(parsed)
    expect(cmd.animationName).toBe('intimate')
    expect(cmd.fvDelta).toBe(8)
  })

  it('maps talk by default', () => {
    const parsed = parseResponse('「你好」')
    const cmd = mapEmotionToAnimation(parsed)
    expect(cmd.animationName).toBe('talk')
    expect(cmd.fvDelta).toBe(2)
  })
})
