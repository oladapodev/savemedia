import { View } from 'react-native';

import { radius } from './tokens';
import { useTheme } from './theme';

type ProgressBarProps = {
  label: string;
  value: number;
};

export function ProgressBar({ label, value }: ProgressBarProps) {
  const { colors } = useTheme();
  const normalizedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="none"
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: 100,
        min: 0,
        now: normalizedValue,
      }}
      accessible
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.round,
        height: 8,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          backgroundColor: colors.accent,
          height: '100%',
          width: `${normalizedValue}%`,
        }}
      />
    </View>
  );
}
