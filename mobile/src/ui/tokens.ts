export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { control: 12, card: 16, sheet: 20, round: 999 } as const;
export const elevation = { flat: 0, raised: 0, floating: 0 } as const;

const standardMotion = { feedbackDuration: 120, stateDuration: 220, decorativeDistance: 10 } as const;
const reducedMotion: Record<keyof typeof standardMotion, number> = { feedbackDuration: 0, stateDuration: 0, decorativeDistance: 0 };
export const motion = { standard: standardMotion, reduced: reducedMotion } as const;

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const },
} as const;

export const lightTheme = {
  canvas: '#FFFFFF', surface: '#FFFFFF', surfaceMuted: '#F6F6F7', inset: '#F2F2F3',
  text: '#151515', textMuted: '#707070', border: '#E7E7E9', accent: '#FA6E09',
  action: '#D94F00', accentText: '#FFFFFF', danger: '#C9342F', dangerSoft: '#FFF0EF',
  success: '#14885F', successSoft: '#EAF8F1', warning: '#B56600', overlay: 'rgba(0,0,0,0.48)',
  promo: '#171717', promoText: '#FFFFFF', heroText: '#FFFFFF',
} as const;

export const darkTheme: Record<keyof typeof lightTheme, string> = {
  canvas: '#000000', surface: '#111111', surfaceMuted: '#171717', inset: '#191919',
  text: '#FFFFFF', textMuted: '#A5A5A5', border: '#262626', accent: '#FA6E09',
  action: '#E95B00', accentText: '#FFFFFF', danger: '#FF6B66', dangerSoft: '#2A1110',
  success: '#43C994', successSoft: '#0D251B', warning: '#FFB24A', overlay: 'rgba(0,0,0,0.72)',
  promo: '#171717', promoText: '#FFFFFF', heroText: '#FFFFFF',
};

export type ThemeColors = Record<keyof typeof lightTheme, string>;
export type ThemeColor = keyof ThemeColors;
export type Space = keyof typeof space;
export type Elevation = keyof typeof elevation;
