import { create } from 'zustand'

interface SettingsState {
  gatewayWsUrl: string
  authToken: string
  sessionKey: string
  defaultCard: string
  cardImportUrl: string
  companionEnabled: boolean
  companionIdleMinutes: number
  petCharacter: string
  petScale: number
  language: string
  onboardingCompleted: boolean
  updateSettings: (partial: Partial<Omit<SettingsState, 'updateSettings'>>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gatewayWsUrl: 'ws://188.239.18.173:4000/',
  authToken: '',
  sessionKey: 'dyberpet-default',
  defaultCard: 'baiyuan',
  cardImportUrl: 'http://188.239.18.173:5173/baiyuan/baiyuan_card.png',
  companionEnabled: false,
  companionIdleMinutes: 30,
  petCharacter: 'baiyuan',
  petScale: 1.0,
  language: 'zh-CN',
  onboardingCompleted: false,

  updateSettings: (partial) => set(partial),
}))
