import {
  type PressableProps,
  Switch,
  type SwitchProps,
} from 'react-native';

import { Text } from './text';
import { MotionPressable } from './motion';
import { useTheme } from './theme';
import { space } from './tokens';

type TextLinkProps = Omit<PressableProps, 'children'> & {
  label: string;
};

export function TextLink({ label, style, ...props }: TextLinkProps) {
  return (
    <MotionPressable
      {...props}
      accessibilityLabel={label}
      accessibilityRole="link"
      hitSlop={space.sm}
      style={(state) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          opacity: state.pressed ? 0.72 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Text color="accent" variant="label">
        {label}
      </Text>
    </MotionPressable>
  );
}

type ToggleProps = Omit<SwitchProps, 'accessibilityLabel'> & {
  label: string;
};

export function Toggle({ label, ...props }: ToggleProps) {
  const { colors } = useTheme();

  return (
    <Switch
      {...props}
      accessibilityLabel={label}
      accessibilityRole="switch"
      ios_backgroundColor={colors.surfaceMuted}
      trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
    />
  );
}
