export const colors = {
  brandGold: '#f7c041',
  brandGoldLight: 'rgba(247,192,65,0.05)',
  brandGoldBorder: 'rgba(247,192,65,0.1)',
  brandGoldShadow: 'rgba(247,192,65,0.3)',
  brandGoldHeavyShadow: 'rgba(247,192,65,0.4)',
  danger: '#ef4444',
  dangerLight: 'rgba(239,68,68,0.05)',
  dangerBorder: 'rgba(239,68,68,0.2)',
  dangerShadow: 'rgba(239,68,68,0.3)',
  warning: '#f59e0b',
  warningLight: 'rgba(245,158,11,0.05)',
  warningBorder: 'rgba(245,158,11,0.2)',
  copyright: '#71717a',
  dark: {
    bg: '#18181b',
    cardBg: '#000000',
    border: '#27272a',
    headerBg: 'rgba(39,39,42,0.5)',
    headerBorder: '#27272a',
    text: '#ffffff',
    textMuted: '#a1a1aa',
    detailBg: 'rgba(39,39,42,0.2)',
    detailBorder: 'rgba(39,39,42,0.5)',
    footerBg: 'rgba(39,39,42,0.3)',
    footerBorder: '#18181b',
    warningText: 'rgba(253,230,138,0.7)',
    dangerText: 'rgba(252,165,165,0.7)',
  },
  light: {
    bg: '#fafaf9',
    cardBg: '#ffffff',
    border: '#e7e5e4',
    headerBg: 'rgba(245,245,244,0.5)',
    headerBorder: '#e7e5e4',
    text: '#1c1917',
    textMuted: '#57534e',
    detailBg: '#fafaf9',
    detailBorder: '#e7e5e4',
    footerBg: '#f5f5f4',
    footerBorder: '#e7e5e4',
    warningText: '#92400e',
    dangerText: '#991b1b',
  },
} as const;

export type ThemeMode = 'dark' | 'light';
export const getTheme = (mode: ThemeMode) =>
  mode === 'light' ? colors.light : colors.dark;

export const fontFamily = "'DM Sans', Arial, Helvetica, sans-serif";
