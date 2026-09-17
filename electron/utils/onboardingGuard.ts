import type { SoulLinkSettings } from '../store/settings'

/**
 * Returns true if the app should show the onboarding flow.
 *
 * Since G1, credentials no longer gate onboarding. An incomplete LLM
 * configuration is exposed separately through the Agent's llmConfigured
 * status so users can finish onboarding and configure the connection later.
 */
export function needsOnboarding(settings: SoulLinkSettings): boolean {
  return !settings.onboarding.completed
}
