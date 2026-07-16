import {
  Button,
  Icon,
  IconButton,
  Inline,
  PageHeader,
  ResponsiveGrid,
  Screen,
  Stack,
  Surface,
  Text,
} from '../../ui';
import { HistoryItem } from './item';
import type { HistoryDeleteChoice } from '../../history/delete';

export type HistoryItemModel = {
  dateLabel: string;
  detail: string;
  id: string;
  sourceLabel: string;
  status: 'Saved' | 'Failed';
  title: string;
  assetUri?: string;
  sourceUrl?: string;
};

type HistoryScreenProps = {
  items: HistoryItemModel[];
  notice?: string;
  onDeleteSelected?: (ids: string[], choice: HistoryDeleteChoice) => void;
  onOpenItem?: (item: HistoryItemModel) => void;
  onRetryItem?: (item: HistoryItemModel) => void;
  onSelect?: () => void;
  onShareItem?: (item: HistoryItemModel) => void;
  onToggleItem?: (item: HistoryItemModel) => void;
  selectedIds?: string[];
  selecting?: boolean;
};

export function EmptyHistory() {
  return (
    <Surface padding="lg">
      <Stack gap="sm">
        <Icon color="accent" name="history" size={32} />
        <Text variant="title">Nothing saved yet</Text>
        <Text color="textMuted">Your saved downloads will appear here.</Text>
      </Stack>
    </Surface>
  );
}

export function SelectionBar({
  onDelete,
  selectedIds,
}: {
  onDelete?: (ids: string[], choice: HistoryDeleteChoice) => void;
  selectedIds: string[];
}) {
  return (
    <Surface tone="surfaceMuted">
      <Inline justify="between">
        <Text variant="label">{selectedIds.length} selected</Text>
        <Stack gap="sm">
          <Button
            accessibilityLabel="Remove selected from history"
            label="Remove history"
            onPress={() => onDelete?.(selectedIds, 'history-only')}
            variant="secondary"
          />
          <Button
            accessibilityLabel="Delete selected from device and history"
            label="Delete device files"
            onPress={() => onDelete?.(selectedIds, 'device-and-history')}
            variant="danger"
          />
        </Stack>
      </Inline>
    </Surface>
  );
}

export function HistoryGrid({
  items,
  onOpenItem,
  onRetryItem,
  onShareItem,
  onToggleItem,
  selectedIds = [],
  selecting = false,
}: Pick<
  HistoryScreenProps,
  | 'items'
  | 'onOpenItem'
  | 'onRetryItem'
  | 'onShareItem'
  | 'onToggleItem'
  | 'selectedIds'
  | 'selecting'
>) {
  const groups = items.reduce<Record<string, HistoryItemModel[]>>((result, item) => {
    result[item.dateLabel] = [...(result[item.dateLabel] ?? []), item];
    return result;
  }, {});

  return (
    <Stack gap="lg">
      {Object.entries(groups).map(([dateLabel, groupItems]) => (
        <Stack gap="sm" key={dateLabel}>
          <Text accessibilityRole="header" variant="label">
            {dateLabel}
          </Text>
          <ResponsiveGrid>
            {groupItems.map((item) => (
              <HistoryItem
                item={item}
                key={item.id}
                onOpen={onOpenItem}
                onRetry={onRetryItem}
                onShare={onShareItem}
                onToggle={onToggleItem}
                selected={selectedIds.includes(item.id)}
                selecting={selecting}
              />
            ))}
          </ResponsiveGrid>
        </Stack>
      ))}
    </Stack>
  );
}

export function HistoryScreen({
  items,
  notice,
  onDeleteSelected,
  onOpenItem,
  onRetryItem,
  onSelect,
  onShareItem,
  onToggleItem,
  selectedIds = [],
  selecting = false,
}: HistoryScreenProps) {
  return (
    <Screen scroll>
      <Stack gap="lg">
        <PageHeader
          action={(
            <Button
              accessibilityLabel="Select downloads"
              label="Select"
              onPress={onSelect}
              variant="secondary"
            />
          )}
          subtitle="Stored only on this device"
          title="History"
        />
        {notice ? <Text color="textMuted">{notice}</Text> : null}
        {selecting ? (
          <SelectionBar onDelete={onDeleteSelected} selectedIds={selectedIds} />
        ) : null}
        {items.length === 0 ? (
          <EmptyHistory />
        ) : (
          <HistoryGrid
            items={items}
            onOpenItem={onOpenItem}
            onRetryItem={onRetryItem}
            onShareItem={onShareItem}
            onToggleItem={onToggleItem}
            selectedIds={selectedIds}
            selecting={selecting}
          />
        )}
      </Stack>
    </Screen>
  );
}
