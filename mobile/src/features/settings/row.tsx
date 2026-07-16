import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Inline, Stack, Surface, Text } from '../../ui';

type SettingRowProps = {
  accessibilityLabel?: string;
  control?: ReactNode;
  description?: string;
  onPress?: () => void;
  title: string;
  value?: string;
};

export function SettingRow({
  accessibilityLabel,
  control,
  description,
  onPress,
  title,
  value,
}: SettingRowProps) {
  const content = (
    <Surface>
      <Inline justify="between" wrap>
        <Stack gap="xs" grow>
          <Text variant="label">{title}</Text>
          {description ? (
            <Text color="textMuted" variant="caption">
              {description}
            </Text>
          ) : null}
          {value ? <Text color="accent">{value}</Text> : null}
        </Stack>
        {control}
      </Inline>
    </Surface>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
    >
      {content}
    </Pressable>
  );
}
