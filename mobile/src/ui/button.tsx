import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Icon, type IconName } from './icon';
import { Inline } from './layout';
import { radius, space, type ThemeColor } from './tokens';
import { Text } from './text';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
};

const buttonColors: Record<
  ButtonVariant,
  { background: ThemeColor; border: ThemeColor; foreground: ThemeColor }
> = {
  primary: { background: 'accent', border: 'accent', foreground: 'accentText' },
  secondary: { background: 'surface', border: 'border', foreground: 'text' },
  danger: { background: 'danger', border: 'danger', foreground: 'accentText' },
};

export function Button({
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  style,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const palette = buttonColors[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      style={(state) => [
        {
          alignItems: 'center',
          backgroundColor: colors[palette.background],
          borderColor: colors[palette.border],
          borderRadius: radius.control,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 52,
          opacity: inactive ? 0.55 : state.pressed ? 0.8 : 1,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Inline gap="sm">
        {loading ? (
          <ActivityIndicator
            accessibilityElementsHidden
            color={colors[palette.foreground]}
          />
        ) : null}
        <Text color={palette.foreground} variant="label">
          {label}
        </Text>
      </Inline>
    </Pressable>
  );
}

export type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: IconName;
  label: string;
  tone?: ThemeColor;
};

export function IconButton({
  disabled = false,
  icon,
  label,
  style,
  tone = 'text',
  ...props
}: IconButtonProps) {
  const { colors } = useTheme();
  const inactive = Boolean(disabled);

  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      hitSlop={space.sm}
      style={(state) => [
        {
          alignItems: 'center',
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.round,
          height: 44,
          justifyContent: 'center',
          opacity: inactive ? 0.55 : state.pressed ? 0.72 : 1,
          width: 44,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Icon color={tone} name={icon} />
    </Pressable>
  );
}
