import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { type ThemeColor } from './tokens';
import { useTheme } from './theme';

const symbols = {
  check: { ios: 'checkmark', android: 'check' },
  close: { ios: 'xmark', android: 'close' },
  download: { ios: 'arrow.down.circle', android: 'download' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  home: { ios: 'house', android: 'home' },
  info: { ios: 'info.circle', android: 'info' },
  settings: { ios: 'gearshape', android: 'settings' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  trash: { ios: 'trash', android: 'delete' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof symbols;

export type IconProps = Omit<
  SymbolViewProps,
  'colors' | 'fallback' | 'name' | 'tintColor'
> & {
  color?: ThemeColor;
  name: IconName;
};

export function Icon({ color = 'text', name, size = 24, ...props }: IconProps) {
  const { colors } = useTheme();

  return (
    <SymbolView
      {...props}
      accessibilityElementsHidden
      fallback={<View style={{ height: size, width: size }} />}
      importantForAccessibility="no-hide-descendants"
      name={symbols[name]}
      size={size}
      tintColor={colors[color]}
    />
  );
}
