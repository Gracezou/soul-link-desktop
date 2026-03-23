export interface ThemeColors {
  primary: string
  primaryLight: string
  primarySoft: string

  bgPrimary: string
  bgSecondary: string
  bgGradientStart: string
  bgGradientEnd: string

  textPrimary: string
  textSecondary: string
  textMuted: string

  chatBubbleUser: string
  chatBubbleAssistant: string
  chatBubbleBorder: string
  chatInputBg: string
  chatHeaderBg: string

  toolbarBg: string
  toolbarBorder: string
  toolbarHover: string

  success: string
  warning: string
  error: string

  divider: string
  shadow: string
}

export interface Theme {
  name: string
  label: string
  labelEn: string
  colors: ThemeColors
}

export type ThemeName = 'warm-pink' | 'sunshine'
