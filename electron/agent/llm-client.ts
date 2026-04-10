import { createApiLogger } from '../logger'
import type { AgentConfig } from './types'

type ChatMessage = { role: string; content: string }

type StreamCallbacks = {
  onDelta: (text: string) => void
  onComplete: (fullText: string) => void
  onError: (err: string) => void
}

type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

const REQUEST_TIMEOUT_MS = 30_000
const MAX_NETWORK_RETRIES = 2

export class LlmClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly apiLog = createApiLogger()

  constructor(config: Pick<AgentConfig, 'baseUrl' | 'apiKey' | 'model'>) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.model = config.model
  }

  async streamChat(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    let lastNetworkError: unknown = null

    for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt += 1) {
      try {
        await this.streamChatOnce(messages, callbacks)
        return
      } catch (error) {
        if (!this.isNetworkError(error)) {
          callbacks.onError(this.toErrorMessage(error))
          return
        }

        lastNetworkError = error
        if (attempt === MAX_NETWORK_RETRIES) {
          callbacks.onError(this.toErrorMessage(lastNetworkError))
          return
        }
      }
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<string> {
    const startTime = Date.now()
    this.apiLog.request({ purpose: 'completion', model: this.model, messageCount: messages.length })

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
    }
    if (options?.temperature !== undefined) body.temperature = options.temperature
    if (options?.max_tokens !== undefined) body.max_tokens = options.max_tokens

    const response = await this.request('/chat/completions', body)
    if (!response.ok) {
      const snippet = await this.readResponseSnippet(response)
      this.apiLog.response({ purpose: 'completion', latencyMs: Date.now() - startTime, status: response.status, error: snippet })
      throw new Error(`HTTP ${response.status}: ${snippet}`)
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const result = payload?.choices?.[0]?.message?.content ?? ''
    this.apiLog.response({ purpose: 'completion', latencyMs: Date.now() - startTime, status: response.status, responseLength: result.length })
    return result
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const body = {
      model: this.model,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    }

    let lastNetworkError: unknown = null

    for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt += 1) {
      try {
        const response = await this.request('/chat/completions', body)
        if (!response.ok) {
          const snippet = await this.readResponseSnippet(response)
          return {
            success: false,
            error: `HTTP ${response.status}: ${snippet}`
          }
        }

        const payload = await response.json().catch(() => null)
        const text = payload?.choices?.[0]?.message?.content
        if (typeof text !== 'string') {
          return {
            success: false,
            error: 'Endpoint reachable but response format is invalid'
          }
        }

        return { success: true }
      } catch (error) {
        if (!this.isNetworkError(error)) {
          return { success: false, error: this.toErrorMessage(error) }
        }

        lastNetworkError = error
        if (attempt === MAX_NETWORK_RETRIES) {
          return { success: false, error: this.toErrorMessage(lastNetworkError) }
        }
      }
    }

    return { success: false, error: 'Unknown connection error' }
  }

  private async streamChatOnce(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const startTime = Date.now()
    this.apiLog.request({ purpose: 'chat', model: this.model, messageCount: messages.length })

    const response = await this.request('/chat/completions', {
      model: this.model,
      messages,
      stream: true
    })

    if (!response.ok) {
      const snippet = await this.readResponseSnippet(response)
      this.apiLog.response({ purpose: 'chat', latencyMs: Date.now() - startTime, status: response.status, error: snippet })
      callbacks.onError(`HTTP ${response.status}: ${snippet}`)
      return
    }

    if (!response.body) {
      this.apiLog.response({ purpose: 'chat', latencyMs: Date.now() - startTime, status: response.status, error: 'empty body' })
      callbacks.onError('Response body is empty')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let deltaCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trimEnd()
        if (!line.startsWith('data: ')) {
          continue
        }

        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          this.apiLog.streaming({ deltaCount, totalLength: fullText.length, latencyMs: Date.now() - startTime })
          callbacks.onComplete(fullText)
          return
        }

        let parsed: OpenAIStreamChunk
        try {
          parsed = JSON.parse(data) as OpenAIStreamChunk
        } catch {
          continue
        }

        const delta = parsed.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) {
          fullText += delta
          deltaCount += 1
          callbacks.onDelta(delta)
        }
      }
    }

    const remaining = (buffer + decoder.decode()).trimEnd()
    if (remaining.startsWith('data: ')) {
      const data = remaining.slice(6).trim()
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data) as OpenAIStreamChunk
          const delta = parsed.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta
            callbacks.onDelta(delta)
          }
        } catch {
          // Ignore trailing non-JSON chunk content.
        }
      }
    }

    this.apiLog.streaming({ deltaCount, totalLength: fullText.length, latencyMs: Date.now() - startTime })
    callbacks.onComplete(fullText)
  }

  private async request(path: string, payload: Record<string, unknown>): Promise<Response> {
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  private async readResponseSnippet(response: Response): Promise<string> {
    const text = await response.text().catch(() => '')
    const normalized = text.trim()
    if (!normalized) {
      return 'Empty response body'
    }
    return normalized.slice(0, 300)
  }

  private isNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }

    const maybeError = error as { name?: unknown }
    if (maybeError.name === 'AbortError') {
      return true
    }

    return error instanceof TypeError
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message
    }
    return String(error)
  }
}
