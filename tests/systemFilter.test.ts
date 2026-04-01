import { isSystemMessage } from '../src/utils/systemFilter'

describe('isSystemMessage', () => {
  it('detects asset list response', () => {
    expect(isSystemMessage('📋 资产列表（第 1/1 页）')).toBe(true)
  })

  it('detects card import success', () => {
    expect(isSystemMessage('✅ 🎭 角色卡导入成功')).toBe(true)
  })

  it('detects error response', () => {
    expect(isSystemMessage('❌ Asset not found')).toBe(true)
  })

  it('detects session info', () => {
    expect(isSystemMessage('📜 session info here')).toBe(true)
  })

  it('detects active session message', () => {
    expect(isSystemMessage('Active session already exists in this channel')).toBe(true)
  })

  it('detects rp command patterns', () => {
    expect(isSystemMessage('rp start --card baiyuan')).toBe(true)
    expect(isSystemMessage('rp import-card ...')).toBe(true)
    expect(isSystemMessage('rp session')).toBe(true)
    expect(isSystemMessage('rp end')).toBe(true)
  })

  it('detects session state changes', () => {
    expect(isSystemMessage('session started')).toBe(true)
    expect(isSystemMessage('session ended')).toBe(true)
  })

  it('detects Chinese system messages', () => {
    expect(isSystemMessage('没有资产')).toBe(true)
    expect(isSystemMessage('角色卡导入成功')).toBe(true)
  })

  it('does NOT detect normal character dialogue', () => {
    expect(isSystemMessage('*柏源笑了笑。* "早上好。"')).toBe(false)
    expect(isSystemMessage('"今天想吃什么？"')).toBe(false)
    expect(isSystemMessage('*他端着一碗汤走了过来。*')).toBe(false)
  })

  it('handles whitespace', () => {
    expect(isSystemMessage('  📋 资产列表  ')).toBe(true)
    expect(isSystemMessage('  "你好" ')).toBe(false)
  })
})
