import { Children, type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, useWindowDimensions, View, type ViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { radius, space, type Elevation, type Space, type ThemeColor } from './tokens';
import { Text } from './text';
import { useTheme } from './theme';

type ScreenProps = ViewProps & { contentContainerStyle?: ScrollViewProps['contentContainerStyle']; edges?: readonly Edge[]; scroll?: boolean; scrollTestID?: string };
const readableWidth = 720;
export function Screen({ children, contentContainerStyle, edges = ['top', 'right', 'bottom', 'left'], scroll = false, scrollTestID, style, ...props }: ScreenProps) {
  const { colors } = useTheme();
  const contentStyle: ViewStyle = { alignSelf: 'center', flexGrow: 1, flexShrink: 0, maxWidth: readableWidth, minWidth: 0, paddingHorizontal: space.md, paddingVertical: space.lg, width: '100%' };
  return <SafeAreaView {...props} edges={edges} style={[{ backgroundColor: colors.canvas, flex: 1 }, style]}>
    {scroll ? <ScrollView contentContainerStyle={[contentStyle, contentContainerStyle]} keyboardShouldPersistTaps="handled" testID={scrollTestID}>{children}</ScrollView>
      : <View style={[contentStyle, contentContainerStyle]}>{children}</View>}
  </SafeAreaView>;
}

type LayoutProps = ViewProps & { gap?: Space | number; grow?: boolean };
const resolveGap = (gap: Space | number) => typeof gap === 'number' ? gap : space[gap];
export function Stack({ gap = 'md', grow = false, style, ...props }: LayoutProps) {
  return <View {...props} style={[{ flex: grow ? 1 : undefined, flexShrink: grow ? 1 : 0, gap: resolveGap(gap), maxWidth: '100%', minWidth: 0 }, style]} />;
}

type InlineProps = LayoutProps & { justify?: 'start' | 'center' | 'end' | 'between'; wrap?: boolean };
const justifyContent = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const;
export function Inline({ gap = 'sm', grow = false, justify = 'start', style, wrap = false, ...props }: InlineProps) {
  return <View {...props} style={[{ alignItems: 'center', flex: grow ? 1 : undefined, flexDirection: 'row', flexShrink: 1,
    flexWrap: wrap ? 'wrap' : 'nowrap', gap: resolveGap(gap), justifyContent: justifyContent[justify], maxWidth: '100%', minWidth: 0 }, style]} />;
}

type SurfaceProps = ViewProps & { children?: ReactNode; level?: Elevation; padding?: Space | number; tone?: Extract<ThemeColor, 'surface' | 'surfaceMuted' | 'dangerSoft' | 'successSoft' | 'promo'> };
export function Surface({ children, padding = 'md', style, tone = 'surface', ...props }: SurfaceProps) {
  const { colors } = useTheme();
  return <View {...props} style={[{ backgroundColor: colors[tone], borderColor: colors.border, borderRadius: radius.card,
    borderWidth: 1, flexShrink: 0, maxWidth: '100%', minWidth: 0, padding: resolveGap(padding) }, style]}>{children}</View>;
}

export function Divider({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return <View {...props} accessibilityElementsHidden style={[{ backgroundColor: colors.border, height: 1, width: '100%' }, style]} />;
}

export function PageHeader({ action, subtitle, title }: { action?: ReactNode; subtitle?: string; title: string }) {
  return <Inline justify="between"><Stack gap="xs" grow><Text accessibilityRole="header" variant="title">{title}</Text>
    {subtitle ? <Text color="textMuted" variant="caption">{subtitle}</Text> : null}</Stack>{action}</Inline>;
}

const largeTextScale = 1.3;
export function getResponsiveColumnCount({ fontScale, maxColumns = 2, minItemWidth = 280, width }: { fontScale: number; maxColumns?: 1 | 2; minItemWidth?: number; width: number }) {
  const availableWidth = Math.min(width, readableWidth) - (space.md * 2);
  return maxColumns === 1 || fontScale >= largeTextScale || availableWidth < (minItemWidth * 2) + (space.sm * 2) ? 1 : 2;
}
export function ResponsiveGrid({ children, maxColumns = 2, minItemWidth = 280, style, ...props }: ViewProps & { maxColumns?: 1 | 2; minItemWidth?: number }) {
  const { fontScale, width } = useWindowDimensions();
  const columns = getResponsiveColumnCount({ fontScale, maxColumns, minItemWidth, width });
  const childWidth = `${100 / columns}%` as `${number}%`;
  return <View {...props} style={[{ flexDirection: 'row', flexShrink: 1, flexWrap: 'wrap', maxWidth: '100%', minWidth: 0, width: '100%' }, style]}>
    {Children.map(children, (child) => <View style={{ maxWidth: '100%', minWidth: 0, padding: space.xs, width: childWidth }}>{child}</View>)}</View>;
}
