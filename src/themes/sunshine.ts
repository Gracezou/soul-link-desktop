import type { Theme } from './types'

export const sunshine: Theme = {
  name: 'sunshine',
  label: '暖阳',
  labelEn: 'Sunshine',
  colors: {
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primarySoft: 'rgba(245, 158, 11, 0.08)',

    bgPrimary: '#FFFDF5',
    bgSecondary: '#FFFFFF',
    bgGradientStart: '#FFF8E7',
    bgGradientEnd: '#FFFFFF',

    textPrimary: '#451A03',
    textSecondary: '#92600A',
    textMuted: '#C4A35A',

    chatBubbleUser: '#FEF3C7',
    chatBubbleAssistant: '#FFFFFF',
    chatBubbleBorder: '#FDE68A',
    chatInputBg: '#FFFBEB',
    chatHeaderBg: '#FFFBEB',

    toolbarBg: 'rgba(255, 251, 235, 0.85)',
    toolbarBorder: 'rgba(245, 158, 11, 0.15)',
    toolbarHover: 'rgba(245, 158, 11, 0.1)',

    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',

    divider: '#FDE68A',
    shadow: 'rgba(245, 158, 11, 0.08)',
  },
}
