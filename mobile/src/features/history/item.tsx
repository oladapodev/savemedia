import { Button, IconButton, Inline, Stack, Surface, Text } from '../../ui';
import type { HistoryItemModel } from './history';

type HistoryItemProps = {
  item: HistoryItemModel;
  onOpen?: (item: HistoryItemModel) => void;
  onRetry?: (item: HistoryItemModel) => void;
  onShare?: (item: HistoryItemModel) => void;
  onToggle?: (item: HistoryItemModel) => void;
  selected?: boolean;
  selecting?: boolean;
};

export function HistoryItem({
  item,
  onOpen,
  onRetry,
  onShare,
  onToggle,
  selected = false,
  selecting = false,
}: HistoryItemProps) {
  return (
    <Surface
      accessibilityLabel={selected ? `${item.title}, selected` : undefined}
      tone={selected ? 'surfaceMuted' : 'surface'}
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Text numberOfLines={2} variant="label">
            {item.title}
          </Text>
          <Text color="textMuted" variant="caption">
            {item.sourceLabel} · {item.status}
          </Text>
          <Text color="textMuted" numberOfLines={2} variant="caption">
            {item.detail}
          </Text>
        </Stack>
        {selecting ? (
          <Button
            accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${item.title}`}
            label={selected ? 'Deselect' : 'Select'}
            onPress={() => onToggle?.(item)}
            variant={selected ? 'primary' : 'secondary'}
          />
        ) : item.status === 'Failed' ? (
          <Button
            accessibilityLabel={`Retry ${item.title}`}
            label="Retry"
            onPress={() => onRetry?.(item)}
          />
        ) : (
          <Inline justify="between" wrap>
            <Button
              accessibilityLabel={`Open ${item.title}`}
              label="Open"
              onPress={() => onOpen?.(item)}
              variant="secondary"
            />
            <IconButton
              icon="share"
              label={`Share ${item.title}`}
              onPress={() => onShare?.(item)}
            />
          </Inline>
        )}
      </Stack>
    </Surface>
  );
}
