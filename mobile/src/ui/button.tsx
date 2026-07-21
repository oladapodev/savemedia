import { ActivityIndicator, type PressableProps } from 'react-native';
import { Icon, type IconName } from './icon';
import { Inline } from './layout';
import { MotionPressable } from './motion';
import { radius, space, type ThemeColor } from './tokens';
import { Text } from './text';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonProps = Omit<PressableProps, 'children'> & { icon?: IconName; label: string; loading?: boolean; variant?: ButtonVariant };
const palette: Record<ButtonVariant, { background: ThemeColor; border: ThemeColor; foreground: ThemeColor }> = {
  primary: { background: 'action', border: 'action', foreground: 'accentText' },
  secondary: { background: 'surfaceMuted', border: 'border', foreground: 'text' },
  danger: { background: 'danger', border: 'danger', foreground: 'accentText' },
  ghost: { background: 'surface', border: 'surface', foreground: 'accent' },
};

export function Button({ accessibilityLabel, disabled = false, icon, label, loading = false, style, variant = 'primary', ...props }: ButtonProps) {
  const { colors } = useTheme();
  const selected = palette[variant];
  const inactive = disabled || loading;
  return (
    <MotionPressable {...props} accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }} disabled={inactive}
      style={(state) => [{ alignItems: 'center', backgroundColor: colors[selected.background], borderColor: colors[selected.border],
        borderRadius: radius.control, borderWidth: 1, flexShrink: 0, justifyContent: 'center', maxWidth: '100%', minHeight: 48, minWidth: 0,
        opacity: inactive ? 0.45 : state.pressed ? 0.72 : 1, paddingHorizontal: space.md, paddingVertical: 11 },
      typeof style === 'function' ? style(state) : style]}>
      <Inline gap="sm" justify="center">
        {loading ? <ActivityIndicator color={colors[selected.foreground]} /> : icon ? <Icon color={selected.foreground} name={icon} size={18} /> : null}
        <Text color={selected.foreground} style={{ flexShrink: 1, minWidth: 0, textAlign: 'center' }} variant="label">{label}</Text>
      </Inline>
    </MotionPressable>
  );
}

export type IconButtonProps = Omit<PressableProps, 'children'> & { icon: IconName; label: string; tone?: ThemeColor };
export function IconButton({ disabled = false, icon, label, style, tone = 'text', ...props }: IconButtonProps) {
  const { colors } = useTheme();
  return <MotionPressable {...props} accessibilityLabel={label} accessibilityRole="button" disabled={disabled} hitSlop={space.sm}
    style={(state) => [{ alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.round, height: 44,
      flexShrink: 0, justifyContent: 'center', maxWidth: '100%', opacity: disabled ? 0.45 : state.pressed ? 0.65 : 1, width: 44 },
    typeof style === 'function' ? style(state) : style]}><Icon color={tone} name={icon} size={20} /></MotionPressable>;
}
