import Store from 'electron-store'

export interface SoulLinkSettings {
  cpa: {
    baseUrl: string
    apiKey: string
    model: string
  }
  character: {
    cardName: string
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
    theme: string
  }
  onboarding: {
    completed: boolean
    completedAt?: string
  }
}

const defaults: SoulLinkSettings = {
  cpa: {
    baseUrl: '',
    apiKey: '',
    model: 'MiniMax-M2',
  },
  character: {
    cardName: 'baiyuan',
  },
  companion: {
    enabled: false,
    idleMinutes: 30,
    mode: 'balanced',
  },
  pet: {
    character: 'baiyuan',
    positionX: -1,
    positionY: -1,
    scale: 1.0,
  },
  ui: {
    language: 'zh-CN',
    theme: 'warm-pink',
  },
  onboarding: {
    completed: false,
  },
}

// electron-store migrations: migrate from openclaw schema (v0.1.x) to cpa schema (v0.2.0)
type LegacySettings = Record<string, unknown> & {
  openclaw?: {
    authToken?: string
    defaultCard?: string
  }
}

const store = new Store<SoulLinkSettings>({
  defaults,
  name: 'settings',
  migrations: {
    '0.2.0': (migratingStore: any) => {
      const raw = migratingStore.store as LegacySettings
      if (raw.openclaw && typeof raw.openclaw === 'object') {
        const legacy = raw.openclaw
        migratingStore.set('cpa', {
          baseUrl: '',
          apiKey: typeof legacy.authToken === 'string' ? legacy.authToken : '',
          model: 'MiniMax-M2',
        })
        migratingStore.set('character', {
          cardName: typeof legacy.defaultCard === 'string' ? legacy.defaultCard : 'baiyuan',
        })
        migratingStore.delete('openclaw' as keyof SoulLinkSettings)
      }
    },
  } as any,
})

export function getSettings(): SoulLinkSettings {
  return store.store
}

export function updateSettings(partial: Partial<SoulLinkSettings>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key as keyof SoulLinkSettings, value)
  }
}

export function getCpaConfig(): SoulLinkSettings['cpa'] {
  return store.get('cpa')
}

export function updateCpaConfig(partial: Partial<SoulLinkSettings['cpa']>): void {
  const current = store.get('cpa')
  store.set('cpa', { ...current, ...partial })
}

export { store }
