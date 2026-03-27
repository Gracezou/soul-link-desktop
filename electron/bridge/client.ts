import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { randomUUID as uuidv4 } from 'crypto'
import type { BridgeConfig } from './config'
import type {
  GatewayMessage,
  GatewayResponse,
  GatewayEvent,
  ConnectChallengePayload,
  ChatEventPayload,
  BridgeMessage,
} from './types'
import { createLogger } from '../logger'

const logger = createLogger('Bridge')

export type ClientEvent =
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'error'
  | 'ack'
  | 'delta'

export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: BridgeConfig
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private isConnected = false
  private pendingRequests = new Map<string, {
    resolve: (value: GatewayResponse) => void
    reject: (reason: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  constructor(config: BridgeConfig) {
    super()
    this.config = config
  }

  connect(): void {
    if (this.ws) {
      this.ws.terminate()
    }

    // Extract origin from gateway URL (ws:// → http://)
    const origin = this.config.gatewayWsUrl
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://')
      .replace(/\/$/, '')

    const url = `${this.config.gatewayWsUrl}?token=${encodeURIComponent(this.config.authToken)}`

    this.ws = new WebSocket(url, {
      headers: { origin },
    })

    this.ws.on('open', () => {
      logger.log('WebSocket connected')
      this.reconnectAttempts = 0
    })

    this.ws.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(data.toString())
    })

    this.ws.on('close', () => {
      logger.log('WebSocket disconnected')
      this.isConnected = false
      this.emit('disconnected')
      this.scheduleReconnect()
    })

    this.ws.on('error', (err: Error) => {
      logger.error('WebSocket error:', err.message)
      this.emit('error', { message: err.message })
    })
  }

  private handleMessage(raw: string): void {
    logger.log('← received raw:', raw)
    let msg: GatewayMessage
    try {
      msg = JSON.parse(raw) as GatewayMessage
    } catch {
      logger.warn('Failed to parse message:', raw)
      return
    }

    if (msg.type === 'event') {
      const event = msg as GatewayEvent
      if (event.event === 'connect.challenge') {
        this.handleChallenge(event.payload as unknown as ConnectChallengePayload)
      } else if (event.event === 'chat') {
        this.handleChatEvent(event.payload as unknown as ChatEventPayload)
      }
    } else if (msg.type === 'res') {
      const res = msg as GatewayResponse
      // Handle the handshake connect response (id="1")
      if (res.id === '1' && res.ok) {
        this.markConnected()
        this.emit('_handshake')
      }
      const pending = this.pendingRequests.get(res.id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pendingRequests.delete(res.id)
        pending.resolve(res)
      }
      // Detect chat.send ACK — fire-and-forget responses carry payload.status
      if (res.ok) {
        logger.log(`← res ok id=${res.id} payload=${JSON.stringify(res.payload ?? null)}`)
        if (res.payload?.status === 'started' && res.payload?.runId) {
          logger.log(`← ACK detected runId=${res.payload.runId}`)
          this.emit('ack', { runId: res.payload.runId as string })
        }
      }
    }
  }

  private handleChallenge(_challenge: ConnectChallengePayload): void {
    logger.log('Received connect.challenge, sending connect request')
    const req = {
      type: 'req',
      id: '1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        role: 'operator',
        scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
        auth: { token: this.config.authToken },
        client: {
          id: 'openclaw-control-ui',
          version: 'dev',
          platform: process.platform,
          mode: 'webchat',
        },
        caps: [],
        locale: 'zh-CN',
      },
    }
    this.sendRaw(JSON.stringify(req))
  }

  private handleChatEvent(payload: ChatEventPayload): void {
    if (payload.state !== 'final') {
      logger.log(`← chat event [${payload.runId}] state=${payload.state}`)
      if (payload.state === 'delta' && payload.message?.content?.length) {
        const text = payload.message.content
          .filter((c: { type: string; text?: string }) => c.type === 'text' && c.text)
          .map((c: { type: string; text?: string }) => c.text!)
          .join('')
        if (text) this.emit('delta', { runId: payload.runId, text })
      }
      return
    }
    if (!payload.message?.content?.length) return

    const text = payload.message.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text!)
      .join('')

    if (!text) return

    logger.log(`← chat final [${payload.runId}] ${text.length} chars`)
    const bridgeMsg: BridgeMessage = { runId: payload.runId, text }
    this.emit('message', bridgeMsg)
  }

  sendRequest(method: string, params: Record<string, unknown>): Promise<GatewayResponse> {
    return new Promise((resolve, reject) => {
      const id = uuidv4()
      const timeoutMs = this.config.timeoutSeconds * 1000

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${method} timed out after ${this.config.timeoutSeconds}s`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timer })

      const req = { type: 'req', id, method, params }
      this.sendRaw(JSON.stringify(req))
    })
  }

  sendMessage(message: string): void {
    const idempotencyKey = uuidv4()
    const sessionKey = this.config.sessionKey || 'dyberpet-default'
    const params = {
      message,
      sessionKey,
      idempotencyKey,
    }
    // Fire-and-forget for chat messages (responses come as events)
    const req = { type: 'req', id: uuidv4(), method: 'chat.send', params }
    logger.log(`→ chat.send [idem:${idempotencyKey.slice(0, 8)}] "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`)
    this.sendRaw(JSON.stringify(req))
  }

  waitForFinalResponse(timeoutMs?: number): Promise<BridgeMessage> {
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs ?? this.config.timeoutSeconds * 1000
      const timer = setTimeout(() => {
        this.removeListener('message', handler)
        reject(new Error('Timed out waiting for chat response'))
      }, timeout)

      const handler = (msg: BridgeMessage) => {
        clearTimeout(timer)
        resolve(msg)
      }

      this.once('message', handler)
    })
  }

  private sendRaw(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.log('→ sending:', data)
      this.ws.send(data)
    } else {
      logger.warn('Attempted to send while not connected')
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const backoff = Math.min(
      this.config.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts),
      30000
    )
    logger.log(`Reconnecting in ${backoff}ms (attempt ${this.reconnectAttempts + 1})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectAttempts++
      this.connect()
    }, backoff)
  }

  markConnected(): void {
    this.isConnected = true
    this.emit('connected')
  }

  get connected(): boolean {
    return this.isConnected
  }

  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.pendingRequests.forEach(({ timer, reject }) => {
      clearTimeout(timer)
      reject(new Error('Client destroyed'))
    })
    this.pendingRequests.clear()
    this.ws?.terminate()
    this.ws = null
  }
}
