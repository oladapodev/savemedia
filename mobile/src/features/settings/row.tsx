import type { ReactNode } from 'react';
import { Icon, Inline, MotionPressable, Stack, Text, type IconName, useTheme } from '../../ui';

export function SettingRow({ accessibilityLabel, control, description, icon = 'settings', onPress, title, value }: {
  accessibilityLabel?: string; control?: ReactNode; description?: string; icon?: IconName; onPress?: () => void; title: string; value?: string;
}) {
  const { colors } = useTheme();
  const content = <Stack gap={0}
    style={{ borderBottomColor: colors.border, borderBottomWidth: 1, minHeight: 60, paddingVertical: 10 }}>
    <Inline gap="md">
      <Icon color="textMuted" name={icon} size={20} />
      <Stack gap="xs" grow><Text variant="label">{title}</Text>
        {description ? <Text color="textMuted" variant="caption">{description}</Text> : null}</Stack>
      {value ? <Text color="textMuted" variant="caption">{value}</Text> : null}
      {control}
      {onPress ? <Text color="textMuted">›</Text> : null}
    </Inline>
  </Stack>;
  return onPress ? <MotionPressable accessibilityLabel={accessibilityLabel ?? title} accessibilityRole="link" onPress={onPress}
    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>{content}</MotionPressable> : content;
}
