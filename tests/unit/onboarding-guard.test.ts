import { needsOnboarding } from '../../electron/utils/onboardingGuard'
import type { SoulLinkSettings } from '../../electron/store/settings'

describe('needsOnboarding', () => {
  test('returns true when onboarding is incomplete and CPA fields are empty', () => {
    const settings = {
      onboarding: { completed: false },
      cpa: { baseUrl: '', apiKey: '', model: 'gpt-4o-mini' },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(true)
  })

  test('returns true when only onboarding is not completed', () => {
    const settings = {
      onboarding: { completed: false },
      cpa: { baseUrl: 'https://api.example.com', apiKey: 'secret', model: 'gpt-4o-mini' },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(true)
  })

  test('returns false when onboarding is completed but baseUrl is empty', () => {
    const settings = {
      onboarding: { completed: true },
      cpa: { baseUrl: '', apiKey: 'secret', model: 'gpt-4o-mini' },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(false)
  })

  test('returns false when onboarding is completed but apiKey is empty', () => {
    const settings = {
      onboarding: { completed: true },
      cpa: { baseUrl: 'https://api.example.com', apiKey: '', model: 'gpt-4o-mini' },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(false)
  })

  test('returns false when onboarding is completed and both connection fields are empty', () => {
    const settings = {
      onboarding: { completed: true },
      cpa: { baseUrl: '', apiKey: '', model: 'gpt-4o-mini' },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(false)
  })

  test('returns false when onboarding is completed and all CPA fields are empty', () => {
    const settings = {
      onboarding: { completed: true },
      cpa: { baseUrl: '', apiKey: '', model: '' },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(false)
  })

  test('returns false when onboarding is completed and CPA values are non-empty after trim', () => {
    const settings = {
      onboarding: { completed: true },
      cpa: {
        baseUrl: '  https://api.example.com  ',
        apiKey: '  secret  ',
        model: 'gpt-4o-mini',
      },
    } as unknown as SoulLinkSettings

    expect(needsOnboarding(settings)).toBe(false)
  })
})
