import { warmPink } from './warm-pink'
import { sunshine } from './sunshine'
import type { Theme, ThemeName } from './types'

export type { ThemeName, Theme } from './types'

export const themes: Record<ThemeName, Theme> = {
  'warm-pink': warmPink,
  'sunshine': sunshine,
}

/**
 * Apply theme by setting CSS variables on document root.
 * Call this on app startup and when user switches theme.
 */
export function applyTheme(name: ThemeName | string): void {
  const theme = themes[name as ThemeName]
  if (!theme) {
    applyTheme('warm-pink')
    return
  }

  const root = document.documentElement
  Object.entries(theme.colors).forEach(([key, value]) => {
    // camelCase → kebab-case: bgPrimary → --bg-primary
    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(cssVar, value)
  })
}

export function getThemeList(): Array<{ name: ThemeName; label: string; labelEn: string }> {
  return Object.values(themes).map(t => ({
    name: t.name as ThemeName,
    label: t.label,
    labelEn: t.labelEn,
  }))
}
