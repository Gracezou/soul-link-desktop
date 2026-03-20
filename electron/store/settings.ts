import Store from 'electron-store'

interface SoulLinkSettings {
  openclaw: {
    gatewayWsUrl: string
    authToken: string
    sessionKey: string
    defaultCard: string
    cardImportUrl: string
    timeoutSeconds: number
    reconnectIntervalMs: number
  }
  companion: {
    enabled: boolean
    idleMinutes: number
    mode: 'balanced' | 'checkin' | 'question' | 'report'
  }
  pet: {
    character: string
    positionX: number
    positionY: number
    scale: number
  }
  ui: {
    language: string
  }
}

const defaults: SoulLinkSettings = {
  openclaw: {
    gatewayWsUrl: 'ws://188.239.18.173:4000/',
    authToken: '',
    sessionKey: 'dyberpet-default',
    defaultCard: 'baiyuan',
    cardImportUrl: 'http://188.239.18.173:5173/baiyuan/baiyuan_card.png',
    timeoutSeconds: 30,
    reconnectIntervalMs: 5000,
  },
  companion: {
    enabled: false,
    idleMinutes: 30,
    mode: 'balanced',
  },
  pet: {
    character: 'baiyuan',
    positionX: 100,
    positionY: 100,
    scale: 1.0,
  },
  ui: {
    language: 'zh-CN',
  },
}

const store = new Store<SoulLinkSettings>({
  defaults,
  name: 'settings',
})

export function getSettings(): SoulLinkSettings {
  return store.store
}

export function updateSettings(partial: Partial<SoulLinkSettings>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key as keyof SoulLinkSettings, value)
  }
}

export function getOpenClawConfig() {
  return store.get('openclaw')
}

export function updateOpenClawConfig(partial: Partial<SoulLinkSettings['openclaw']>): void {
  const current = store.get('openclaw')
  store.set('openclaw', { ...current, ...partial })
}

export { store }
