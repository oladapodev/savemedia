import { Children, type ReactNode } from 'react';
import {
  ScrollView,
  type ScrollViewProps,
  useWindowDimensions,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

import {
  elevation,
  radius,
  space,
  type Elevation,
  type Space,
  type ThemeColor,
} from './tokens';
import { Text } from './text';
import { useTheme } from './theme';

type ScreenProps = ViewProps & {
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  edges?: readonly Edge[];
  scroll?: boolean;
};

export function Screen({
  children,
  contentContainerStyle,
  edges = ['top', 'right', 'bottom', 'left'],
  scroll = false,
  style,
  ...props
}: ScreenProps) {
  const { colors } = useTheme();
  const contentStyle: ViewStyle = {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: readableWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    width: '100%',
  };

  return (
    <SafeAreaView
      {...props}
      edges={edges}
      style={[{ backgroundColor: colors.canvas, flex: 1 }, style]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[contentStyle, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[contentStyle, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type LayoutProps = ViewProps & {
  gap?: Space | number;
  grow?: boolean;
};

function resolveGap(gap: Space | number) {
  return typeof gap === 'number' ? gap : space[gap];
}

export function Stack({ gap = 'md', grow = false, style, ...props }: LayoutProps) {
  return <View {...props} style={[{ flex: grow ? 1 : undefined, gap: resolveGap(gap) }, style]} />;
}

type InlineProps = LayoutProps & {
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
};

const justifyContent = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
} as const;

export function Inline({
  gap = 'sm',
  grow = false,
  justify = 'start',
  style,
  wrap = false,
  ...props
}: InlineProps) {
  return (
    <View
      {...props}
      style={[
        {
          alignItems: 'center',
          flex: grow ? 1 : undefined,
          flexDirection: 'row',
          flexWrap: wrap ? 'wrap' : 'nowrap',
          gap: resolveGap(gap),
          justifyContent: justifyContent[justify],
        },
        style,
      ]}
    />
  );
}

type SurfaceProps = ViewProps & {
  children?: ReactNode;
  level?: Elevation;
  padding?: Space | number;
  tone?: Extract<ThemeColor, 'surface' | 'surfaceMuted'>;
};

export function Surface({
  level = 'flat',
  padding = 'md',
  style,
  tone = 'surface',
  ...props
}: SurfaceProps) {
  const { colors } = useTheme();

  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors[tone],
          borderColor: colors.border,
          borderRadius: radius.card,
          borderWidth: 1,
          elevation: elevation[level],
          padding: resolveGap(padding),
        },
        style,
      ]}
    />
  );
}

export function Divider({ style, ...props }: ViewProps) {
  const { colors } = useTheme();

  return (
    <View
      {...props}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: colors.border, height: 1, width: '100%' }, style]}
    />
  );
}

type PageHeaderProps = {
  action?: ReactNode;
  subtitle?: string;
  title: string;
};

export function PageHeader({ action, subtitle, title }: PageHeaderProps) {
  return (
    <Inline justify="between">
      <Stack gap="xs" grow>
        <Text accessibilityRole="header" variant="title">
          {title}
        </Text>
        {subtitle ? (
          <Text color="textMuted" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {action}
    </Inline>
  );
}

type ResponsiveGridProps = ViewProps & {
  maxColumns?: 1 | 2;
  minItemWidth?: number;
};

type ResponsiveColumnOptions = {
  fontScale: number;
  maxColumns?: 1 | 2;
  minItemWidth?: number;
  width: number;
};

const readableWidth = 720;
const largeTextScale = 1.3;
const defaultGridItemWidth = 280;

export function getResponsiveColumnCount({
  fontScale,
  maxColumns = 2,
  minItemWidth = defaultGridItemWidth,
  width,
}: ResponsiveColumnOptions) {
  const availableWidth = Math.min(width, readableWidth) - (space.md * 2);
  const twoColumnWidth = (minItemWidth * 2) + (space.sm * 2);

  if (maxColumns === 1 || fontScale >= largeTextScale) {
    return 1;
  }

  return availableWidth >= twoColumnWidth ? 2 : 1;
}

export function ResponsiveGrid({
  children,
  maxColumns = 2,
  minItemWidth = defaultGridItemWidth,
  style,
  ...props
}: ResponsiveGridProps) {
  const { fontScale, width } = useWindowDimensions();
  const columns = getResponsiveColumnCount({
    fontScale,
    maxColumns,
    minItemWidth,
    width,
  });
  const childWidth = `${100 / columns}%` as `${number}%`;

  return (
    <View
      {...props}
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -space.xs,
        },
        style,
      ]}
    >
      {Children.map(children, (child) => (
        <View style={{ padding: space.xs, width: childWidth }}>{child}</View>
      ))}
    </View>
  );
}
