export interface BridgeConfig {
  gatewayWsUrl: string
  authToken: string
  sessionKey: string
  defaultCard: string
  cardImportUrl: string
  timeoutSeconds: number
  reconnectIntervalMs: number
}

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  gatewayWsUrl: 'ws://188.239.18.173:4000/',
  authToken: '',
  sessionKey: 'dyberpet-default',
  defaultCard: 'baiyuan',
  cardImportUrl: 'http://188.239.18.173:5173/baiyuan/baiyuan_card.png',
  timeoutSeconds: 30,
  reconnectIntervalMs: 5000,
}
