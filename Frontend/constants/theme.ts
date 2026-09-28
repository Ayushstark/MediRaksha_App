export const colors = {
  background: '#F5F7FB',
  backgroundDark: '#07111F',
  surface: '#FFFFFF',
  surfaceDark: '#0F172A',
  surfaceMuted: '#F8FAFC',
  surfaceMutedDark: '#111827',
  primary: '#1A237E',
  primarySoft: '#EEF2FF',
  primaryMid: '#3762F0',
  success: '#16A34A',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  text: '#0F172A',
  textInverse: '#FFFFFF',
  textMuted: '#64748B',
  textSoft: '#94A3B8',
  border: '#E2E8F0',
  borderDark: '#1F2937',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const typography = {
  h1: { fontSize: 30, fontWeight: '900' as const, lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: '900' as const, lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '900' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '700' as const, lineHeight: 16 },
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
};

export const shadows = {
  card: {
    elevation: 4,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
};

export const gradients = {
  hero: ['#1A237E', '#3762F0'] as const,
  dark: ['#111827', '#334155'] as const,
  success: ['#16A34A', '#047857'] as const,
  health: ['#0F766E', '#16A34A'] as const,
  emergency: ['#DC2626', '#F97316'] as const,
};

export const themes = {
  light: {
    background: colors.background,
    surface: colors.surface,
    surfaceMuted: colors.surfaceMuted,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
  },
  dark: {
    background: colors.backgroundDark,
    surface: colors.surfaceDark,
    surfaceMuted: colors.surfaceMutedDark,
    text: colors.textInverse,
    textMuted: colors.textSoft,
    border: colors.borderDark,
  },
};
