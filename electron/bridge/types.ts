// Gateway frame types

export interface GatewayFrame {
  type: 'req' | 'res' | 'event'
}

export interface GatewayRequest extends GatewayFrame {
  type: 'req'
  id: string
  method: string
  params: Record<string, unknown>
}

export interface GatewayResponse extends GatewayFrame {
  type: 'res'
  id: string
  ok: boolean
  result?: unknown
  error?: { code: number; message: string }
}

export interface GatewayEvent extends GatewayFrame {
  type: 'event'
  event: string
  payload: Record<string, unknown>
}

export type GatewayMessage = GatewayRequest | GatewayResponse | GatewayEvent

// connect.challenge event payload
export interface ConnectChallengePayload {
  nonce: string
  ts: number
}

// chat event payload
export interface ChatEventPayload {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'error'
  message?: {
    role: string
    content: Array<{ type: string; text?: string }>
  }
  error?: string
}

export interface BridgeMessage {
  runId: string
  text: string
}

export interface BridgeSessionStatus {
  ready: boolean
  card: string
}
