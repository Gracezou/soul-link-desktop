import type { SoulLinkSettings } from '../store/settings'

/**
 * Returns true if the app should show the onboarding flow.
 *
 * Triggers (any one is sufficient):
 * - onboarding.completed is false
 * - cpa.baseUrl is empty or whitespace-only
 * - cpa.apiKey is empty or whitespace-only
 *
 * Note: cpa.model has a sensible default and is NOT checked here.
 */
export function needsOnboarding(settings: SoulLinkSettings): boolean {
  const { onboarding, cpa } = settings
  return (
    !onboarding.completed ||
    !cpa.baseUrl.trim() ||
    !cpa.apiKey.trim()
  )
}
