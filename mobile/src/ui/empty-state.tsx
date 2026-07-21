import { View } from 'react-native';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Stack } from './layout';
import { radius, space } from './tokens';
import { Text } from './text';
import { useTheme } from './theme';

export type EmptyStateProps = {
  action?: {
    label: string;
    onPress: () => void;
  };
  detail: string;
  icon: IconName;
  title: string;
};

export function EmptyState({ action, detail, icon, title }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <Stack gap="md" style={{ alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.lg, width: '100%' }}>
      <View
        accessibilityLabel={`${title} illustration`}
        accessibilityRole="image"
        style={{
          alignItems: 'center',
          borderColor: colors.border,
          borderRadius: radius.round,
          borderWidth: 1,
          height: 104,
          justifyContent: 'center',
          width: 104,
        }}
      >
        <View style={{ borderColor: colors.accent, borderRadius: radius.round, borderWidth: 1, height: 62, position: 'absolute', transform: [{ rotate: '18deg' }], width: 62 }} />
        <View style={{ borderColor: colors.border, borderRadius: radius.control, borderWidth: 1, height: 42, position: 'absolute', transform: [{ rotate: '-18deg' }], width: 42 }} />
        <Icon color="accent" name={icon} size={26} />
      </View>
      <Stack gap="xs" style={{ alignItems: 'center', width: '100%' }}>
        <Text accessibilityRole="header" style={{ textAlign: 'center' }} variant="title">{title}</Text>
        <Text color="textMuted" style={{ maxWidth: 360, textAlign: 'center' }}>{detail}</Text>
      </Stack>
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </Stack>
  );
}
