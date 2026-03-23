import type { Theme } from './types'

export const warmPink: Theme = {
  name: 'warm-pink',
  label: '樱花粉',
  labelEn: 'Sakura Pink',
  colors: {
    primary: '#E91E8C',
    primaryLight: '#F472B6',
    primarySoft: 'rgba(233, 30, 140, 0.08)',

    bgPrimary: '#FFF5F9',
    bgSecondary: '#FFFFFF',
    bgGradientStart: '#FFF0F5',
    bgGradientEnd: '#FFFFFF',

    textPrimary: '#4A1942',
    textSecondary: '#9B6B8E',
    textMuted: '#C9A0B8',

    chatBubbleUser: '#FCE4EC',
    chatBubbleAssistant: '#FFFFFF',
    chatBubbleBorder: '#F8BBD0',
    chatInputBg: '#FDF2F8',
    chatHeaderBg: '#FDF2F8',

    toolbarBg: 'rgba(255, 240, 245, 0.85)',
    toolbarBorder: 'rgba(233, 30, 140, 0.15)',
    toolbarHover: 'rgba(233, 30, 140, 0.1)',

    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',

    divider: '#F8BBD0',
    shadow: 'rgba(233, 30, 140, 0.08)',
  },
}
