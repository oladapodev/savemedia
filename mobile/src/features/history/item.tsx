import { View } from 'react-native';
import { Button, Icon, IconButton, Inline, Stack, Surface, Text, radius, useTheme } from '../../ui';
import type { HistoryItemModel } from './history';

export function HistoryItem({ item, onOpen, onRetry, onShare, onToggle, selected = false, selecting = false }: {
  item: HistoryItemModel; onOpen?: (item: HistoryItemModel) => void; onRetry?: (item: HistoryItemModel) => void;
  onShare?: (item: HistoryItemModel) => void; onToggle?: (item: HistoryItemModel) => void; selected?: boolean; selecting?: boolean;
}) {
  const { colors } = useTheme();
  const saved = item.status === 'Saved';
  const body = <Surface style={{ borderColor: selected ? colors.accent : colors.border }}><Inline gap="md">
    <View style={{ alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.control, height: 58, justifyContent: 'center', width: 58 }}>
      <Icon color={saved ? 'accent' : 'warning'} name={saved ? 'play' : 'warning'} size={24} />
    </View>
    <Stack gap="xs" grow><Text numberOfLines={1} variant="label">{item.title}</Text><Text color="textMuted" variant="caption">{item.sourceLabel}</Text>
      <Text color="textMuted" variant="caption">{item.detail}</Text><Text color={saved ? 'success' : 'warning'} variant="caption">{item.status}</Text></Stack>
    {selecting ? <Button accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${item.title}`} label={selected ? 'Selected' : 'Select'}
      onPress={() => onToggle?.(item)} variant={selected ? 'primary' : 'secondary'} />
      : saved ? <Stack gap="xs"><IconButton icon="play" label={`Open ${item.title}`} onPress={() => onOpen?.(item)} tone="accent" />
        <IconButton icon="share" label={`Share ${item.title}`} onPress={() => onShare?.(item)} /></Stack>
      : item.status === 'Failed' && item.retryable ? <Button accessibilityLabel={`Retry ${item.title}`} label="Retry" onPress={() => onRetry?.(item)} /> : null}
  </Inline></Surface>;
  return body;
}
