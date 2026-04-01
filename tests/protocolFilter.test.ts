import { processResponse } from '../src/utils/protocolFilter'

describe('processResponse', () => {
  it('suppresses system messages (returns null)', () => {
    expect(processResponse('📋 资产列表（第 1/1 页）')).toBeNull()
    expect(processResponse('✅ 🎭 角色卡导入成功')).toBeNull()
    expect(processResponse('❌ Asset not found')).toBeNull()
    expect(processResponse('Active session already exists in this channel')).toBeNull()
  })

  it('extracts emotion and strips tag from display text', () => {
    const result = processResponse('*笑了笑。* "你好。" [emotion:happy]')
    expect(result).not.toBeNull()
    expect(result!.displayText).toBe('*笑了笑。* "你好。"')
    expect(result!.emotion).toBe('happy')
    expect(result!.shouldAnimate).toBe(true)
    expect(result!.oocDetected).toBe(false)
  })

  it('preserves rawText in result', () => {
    const raw = '*笑了笑。* "你好。" [emotion:happy]'
    const result = processResponse(raw)
    expect(result!.rawText).toBe(raw)
  })

  it('handles response without emotion tag', () => {
    const result = processResponse('*点了点头。* "嗯。"')
    expect(result).not.toBeNull()
    expect(result!.displayText).toBe('*点了点头。* "嗯。"')
    expect(result!.emotion).toBeNull()
    expect(result!.shouldAnimate).toBe(false)
  })

  it('detects OOC response', () => {
    const result = processResponse('我是一个AI助手。 [emotion:talk]')
    expect(result).not.toBeNull()
    expect(result!.oocDetected).toBe(true)
  })

  it('does not flag normal dialogue as OOC', () => {
    const result = processResponse('*柏源笑了笑。* "早上好。" [emotion:happy]')
    expect(result).not.toBeNull()
    expect(result!.oocDetected).toBe(false)
  })

  it('handles all emotion types', () => {
    const emotions = ['happy', 'intimate', 'concerned', 'sad', 'playful', 'protective', 'cooking', 'talk']
    for (const e of emotions) {
      const result = processResponse(`"test" [emotion:${e}]`)
      expect(result!.emotion).toBe(e)
    }
  })

  it('rejects invalid emotion but still returns result', () => {
    const result = processResponse('"嗯。" [emotion:angry]')
    expect(result).not.toBeNull()
    expect(result!.emotion).toBeNull()
    expect(result!.shouldAnimate).toBe(false)
  })
})
