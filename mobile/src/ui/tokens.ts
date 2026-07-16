export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  control: 14,
  card: 18,
  sheet: 24,
  round: 999,
} as const;

export const elevation = {
  flat: 0,
  raised: 2,
  floating: 6,
} as const;

const standardMotion = {
  feedbackDuration: 160,
  stateDuration: 240,
  decorativeDistance: 8,
} as const;

const reducedMotion: Record<keyof typeof standardMotion, number> = {
  feedbackDuration: 0,
  stateDuration: 0,
  decorativeDistance: 0,
};

export const motion = {
  standard: standardMotion,
  reduced: reducedMotion,
} as const;

export const type = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '700' as const },
  title: { fontSize: 24, lineHeight: 29, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const },
} as const;

export const lightTheme = {
  canvas: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEFEB',
  text: '#172019',
  textMuted: '#667068',
  border: '#DDE2DC',
  accent: '#397B52',
  accentText: '#FFFFFF',
  danger: '#B3261E',
  success: '#397B52',
  warning: '#8A5A00',
  overlay: 'rgba(23,32,25,0.48)',
} as const;

export const darkTheme: Record<keyof typeof lightTheme, string> = {
  canvas: '#101411',
  surface: '#171D18',
  surfaceMuted: '#222A24',
  text: '#F2F5F1',
  textMuted: '#A8B2AA',
  border: '#303A32',
  accent: '#74C58D',
  accentText: '#0E2616',
  danger: '#FFB4AB',
  success: '#74C58D',
  warning: '#F2C36B',
  overlay: 'rgba(0,0,0,0.62)',
};

export type ThemeColors = Record<keyof typeof lightTheme, string>;
export type ThemeColor = keyof ThemeColors;
export type Space = keyof typeof space;
export type Elevation = keyof typeof elevation;
