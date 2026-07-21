import { View } from 'react-native';
import { Button, IconButton, Inline, MediaThumbnail, Stack, Text, space, useTheme } from '../../ui';
import type { HistoryItemModel } from './history';

export function HistoryItem({ item, last = false, onOpen, onRefreshThumbnail, onRetry, onShare, onToggle, selected = false, selecting = false }: {
  item: HistoryItemModel; onOpen?: (item: HistoryItemModel) => void; onRetry?: (item: HistoryItemModel) => void;
  last?: boolean; onRefreshThumbnail?: (item: HistoryItemModel) => void; onShare?: (item: HistoryItemModel) => void;
  onToggle?: (item: HistoryItemModel) => void; selected?: boolean; selecting?: boolean;
}) {
  const { colors } = useTheme();
  const saved = item.status === 'Saved';
  const body = <View style={{ borderBottomColor: selected ? colors.accent : colors.border, borderBottomWidth: last ? 0 : 1,
    paddingVertical: space.sm }}><Inline gap="md">
    <MediaThumbnail fallbackIcon={saved ? 'play' : 'warning'} label={`${item.title} thumbnail`}
      onError={() => onRefreshThumbnail?.(item)} style={{ height: 58, width: 58 }} uri={item.thumbnailUrl} />
    <Stack gap="xs" grow><Text numberOfLines={1} variant="label">{item.title}</Text><Text color="textMuted" variant="caption">{item.sourceLabel}</Text>
      <Text color="textMuted" variant="caption">{item.detail}</Text><Text color={saved ? 'success' : 'warning'} variant="caption">{item.status}</Text></Stack>
    {selecting ? <Button accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${item.title}`} label={selected ? 'Selected' : 'Select'}
      onPress={() => onToggle?.(item)} variant={selected ? 'primary' : 'secondary'} />
      : saved ? <Stack gap="xs"><IconButton icon="play" label={`Open ${item.title}`} onPress={() => onOpen?.(item)} tone="accent" />
        <IconButton icon="share" label={`Share ${item.title}`} onPress={() => onShare?.(item)} /></Stack>
      : item.status === 'Failed' && item.retryable ? <Button accessibilityLabel={`Retry ${item.title}`} label="Retry" onPress={() => onRetry?.(item)} /> : null}
  </Inline></View>;
  return body;
}
