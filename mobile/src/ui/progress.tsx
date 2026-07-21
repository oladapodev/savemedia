import { View } from 'react-native';
import { radius } from './tokens';
import { useTheme } from './theme';

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  const bounded = Math.max(0, Math.min(100, value));
  return <View accessibilityLabel={label} accessibilityLiveRegion="none" accessibilityRole="progressbar"
    accessibilityValue={{ min: 0, max: 100, now: bounded }} style={{ backgroundColor: colors.inset, borderRadius: radius.round, height: 5, overflow: 'hidden' }}>
    <View style={{ backgroundColor: colors.accent, borderRadius: radius.round, height: '100%', width: `${bounded}%` }} />
  </View>;
}
