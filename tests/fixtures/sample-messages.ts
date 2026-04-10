import type { ChatMessage } from '../../electron/agent/types'

export const sampleMessages: ChatMessage[] = [
  {
    id: 'msg-001',
    session_id: 'session-001',
    role: 'user',
    content: '早上好',
    created_at: 1700000000000,
  },
  {
    id: 'msg-002',
    session_id: 'session-001',
    role: 'assistant',
    content: '*柏源抬起头，嘴角噙着一抹笑意。* "早上好。" [emotion:happy]',
    created_at: 1700000010000,
  },
  {
    id: 'msg-003',
    session_id: 'session-001',
    role: 'user',
    content: '今天想吃什么？',
    created_at: 1700000020000,
  },
  {
    id: 'msg-004',
    session_id: 'session-001',
    role: 'assistant',
    content: '*柏源想了想，走向厨房。* "你想吃清淡的还是重口的？我都可以做。" [emotion:cooking]',
    created_at: 1700000030000,
  },
]

export function generateMessages(count: number, sessionId = 'session-001'): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${String(i).padStart(4, '0')}`,
    session_id: sessionId,
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: i % 2 === 0
      ? `用户消息第${i / 2 + 1}轮，这是测试对话内容。`
      : `*柏源点了点头。* "好的，我明白了。" [emotion:talk]`,
    created_at: 1700000000000 + i * 10000,
  }))
}
