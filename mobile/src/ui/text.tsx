import {
  Text as NativeText,
  type TextProps as NativeTextProps,
} from 'react-native';

import { type, type ThemeColor } from './tokens';
import { useTheme } from './theme';

export type TextVariant = keyof typeof type;

export type TextProps = NativeTextProps & {
  color?: ThemeColor;
  variant?: TextVariant;
};

export function Text({
  color = 'text',
  style,
  variant = 'body',
  ...props
}: TextProps) {
  const { colors } = useTheme();

  return (
    <NativeText
      {...props}
      style={[type[variant], { color: colors[color] }, style]}
    />
  );
}
