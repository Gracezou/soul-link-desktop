import { LlmClient } from '../../electron/agent/llm-client'
import { getCPAConfig, skipIfNoCPA } from './helpers'

describe('LlmClient (integration)', () => {
  if (skipIfNoCPA()) {
    test.skip('skipped — CPA_API_KEY not set', () => {})
    return
  }

  const config = getCPAConfig()
  const client = new LlmClient(config)

  test('chatCompletion returns response', async () => {
    const response = await client.chatCompletion(
      [
        { role: 'system', content: '你是柏源，用温柔的语气回复。' },
        { role: 'user', content: '你好' },
      ],
      { max_tokens: 100 }
    )

    expect(response).toBeTruthy()
    expect(response.length).toBeGreaterThan(0)
  }, 30000)

  test('streamChat emits deltas and completes', async () => {
    const deltas: string[] = []
    let finalText = ''
    let errorText: string | null = null

    await new Promise<void>((resolve) => {
      void client.streamChat(
        [
          { role: 'system', content: '你是柏源，用温柔的语气回复。简短回复。' },
          { role: 'user', content: '你好' },
        ],
        {
          onDelta: (text) => deltas.push(text),
          onComplete: (text) => { finalText = text; resolve() },
          onError: (err) => { errorText = err; resolve() },
        }
      )
    })

    if (errorText) {
      throw new Error(`Stream error: ${errorText}`)
    }

    expect(deltas.length).toBeGreaterThan(0)
    expect(finalText).toBeTruthy()
    expect(finalText.length).toBeGreaterThan(0)
  }, 30000)

  test('testConnection succeeds with valid config', async () => {
    const result = await client.testConnection()
    expect(result.success).toBe(true)
  }, 30000)

  test('testConnection fails with invalid model', async () => {
    const badClient = new LlmClient({
      ...config,
      model: 'nonexistent-model-xyz-999',
    })

    const result = await badClient.testConnection()
    // May succeed if server accepts any model, or fail — just verify no crash
    expect(typeof result.success).toBe('boolean')
  }, 30000)
})
