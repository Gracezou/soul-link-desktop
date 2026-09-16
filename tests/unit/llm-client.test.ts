const mockApiRequest = jest.fn()
const mockApiResponse = jest.fn()
const mockApiStreaming = jest.fn()
const mockWarn = jest.fn()

jest.mock('../../electron/logger', () => ({
  createApiLogger: () => ({
    request: mockApiRequest,
    response: mockApiResponse,
    streaming: mockApiStreaming,
    oocRetry: jest.fn(),
  }),
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: mockWarn,
    error: jest.fn(),
  }),
}))

import { LlmClient } from '../../electron/agent/llm-client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('LlmClient reasoning_split requests', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>

  function requestBody(call: number): Record<string, unknown> {
    const init = fetchMock.mock.calls[call][1]
    return JSON.parse(String(init?.body)) as Record<string, unknown>
  }

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchMock.mockRestore()
  })

  test('sends reasoning_split for chatCompletion', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: 'hello' } }],
    }))
    const client = new LlmClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    await expect(client.chatCompletion([{ role: 'user', content: 'hi' }])).resolves.toBe('hello')

    expect(requestBody(0)).toMatchObject({
      stream: false,
      reasoning_split: true,
    })
  })

  test('sends reasoning_split for testConnection', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: 'pong' } }],
    }))
    const client = new LlmClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    await expect(client.testConnection()).resolves.toEqual({ success: true })

    expect(requestBody(0)).toMatchObject({
      stream: false,
      reasoning_split: true,
    })
  })

  test('sends reasoning_split for streaming chat', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ))
    const client = new LlmClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    const onDelta = jest.fn()
    const onComplete = jest.fn()
    const onError = jest.fn()

    await client.streamChat(
      [{ role: 'user', content: 'hi' }],
      { onDelta, onComplete, onError },
    )

    expect(requestBody(0)).toMatchObject({
      stream: true,
      reasoning_split: true,
    })
    expect(onDelta).toHaveBeenCalledWith('hello')
    expect(onComplete).toHaveBeenCalledWith('hello')
    expect(onError).not.toHaveBeenCalled()
  })

  test('retries one time without reasoning_split and remembers the downgrade', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'unknown parameter: reasoning_split' } }, 400))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'request still rejected' } }, 400))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'hello' } }] }))

    const client = new LlmClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    await expect(client.chatCompletion([{ role: 'user', content: 'first' }]))
      .rejects.toThrow('HTTP 400')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBody(0)).toHaveProperty('reasoning_split', true)
    expect(requestBody(1)).not.toHaveProperty('reasoning_split')
    expect(mockWarn).toHaveBeenCalledTimes(1)
    expect(mockWarn).toHaveBeenCalledWith('reasoning_split unsupported, retried without')

    await expect(client.chatCompletion([{ role: 'user', content: 'second' }])).resolves.toBe('hello')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(requestBody(2)).not.toHaveProperty('reasoning_split')
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })

  test('does not downgrade for an unrelated 4xx response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'authentication failed' } }, 401))
    const client = new LlmClient({
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    await expect(client.chatCompletion([{ role: 'user', content: 'hi' }]))
      .rejects.toThrow('HTTP 401')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockWarn).not.toHaveBeenCalled()
  })
})
