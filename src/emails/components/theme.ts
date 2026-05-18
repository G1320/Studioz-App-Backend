export const colors = {
  brandYellow: '#f7c041',
  brandYellowLight: 'rgba(247,192,65,0.1)',
  brandYellowBorder: 'rgba(247,192,65,0.2)',
  brandYellowShadow: 'rgba(247,192,65,0.3)',
  brandYellowHeavyShadow: 'rgba(247,192,65,0.4)',
  danger: '#ef4444',
  dangerLight: 'rgba(248,113,113,0.15)',
  dangerBorder: 'rgba(248,113,113,0.3)',
  dangerShadow: 'rgba(239,68,68,0.3)',
  warning: '#f59e0b',
  warningLight: 'rgba(251,191,36,0.15)',
  warningBorder: 'rgba(251,191,36,0.2)',
  copyright: '#5c6470',
  dark: {
    bg: '#0a0e14',
    cardBg: '#13171d',
    border: 'rgba(200,205,212,0.12)',
    headerBg: '#1a1f28',
    headerBorder: 'rgba(200,205,212,0.1)',
    text: '#f1f5f9',
    textMuted: '#b8c0cc',
    detailBg: '#1a1f28',
    detailBorder: 'rgba(200,205,212,0.1)',
    footerBg: '#0a0e14',
    footerBorder: 'rgba(200,205,212,0.1)',
    warningText: '#fbbf24',
    dangerText: '#f87171',
  },
  light: {
    bg: '#fafaf9',
    cardBg: '#ffffff',
    border: '#e5e4e2',
    headerBg: '#f2f2f0',
    headerBorder: '#e5e4e2',
    text: '#1c1917',
    textMuted: '#57534e',
    detailBg: '#fafaf9',
    detailBorder: '#e5e4e2',
    footerBg: '#f2f2f0',
    footerBorder: '#e5e4e2',
    warningText: '#b45309',
    dangerText: '#b91c1c',
  },
} as const;

export type ThemeMode = 'dark' | 'light';
export const getTheme = (mode: ThemeMode) =>
  mode === 'light' ? colors.light : colors.dark;

export const fontFamily = "'DM Sans', Arial, Helvetica, sans-serif";
