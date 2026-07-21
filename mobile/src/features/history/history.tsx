import { useMemo, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Button, ChoiceBar, EmptyState, Icon, Inline, PageHeader, Screen, Stack, Surface, Text, radius, useTheme } from '../../ui';
import { HistoryItem } from './item';
import type { HistoryDeleteChoice } from '../../history/delete';

export type HistoryItemModel = {
  dateLabel: string; detail: string; id: string; sourceLabel: string; status: 'Saved' | 'Failed' | 'Cancelled';
  title: string; mediaType?: 'video' | 'image' | 'audio'; assetUri?: string; sourceUrl?: string; thumbnailUrl?: string;
  quality?: 'Balanced' | 'Original' | 'Audio'; retryable?: boolean; sizeLabel?: string;
};
type Filter = 'All' | 'Videos' | 'Images' | 'Audio';

export function HistoryScreen({ items, notice, onDeleteSelected, onOpenItem, onRetryItem, onSelect, onShareItem, onToggleItem,
  selectedIds = [], selecting = false }: {
  items: HistoryItemModel[]; notice?: string; onDeleteSelected?: (ids: string[], choice: HistoryDeleteChoice) => void;
  onOpenItem?: (item: HistoryItemModel) => void; onRetryItem?: (item: HistoryItemModel) => void; onSelect?: () => void;
  onShareItem?: (item: HistoryItemModel) => void; onToggleItem?: (item: HistoryItemModel) => void; selectedIds?: string[]; selecting?: boolean;
}) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter((item) => {
    const matchesText = `${item.title} ${item.sourceLabel}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesType = filter === 'All' || item.mediaType === filter.slice(0, -1).toLowerCase() || (filter === 'Audio' && item.mediaType === 'audio');
    return matchesText && matchesType;
  }), [filter, items, query]);
  const groups = filtered.reduce<Record<string, HistoryItemModel[]>>((result, item) => ({ ...result, [item.dateLabel]: [...(result[item.dateLabel] ?? []), item] }), {});

  return <Screen edges={['top', 'left', 'right']} scroll><Stack gap="lg">
    <PageHeader action={<Button accessibilityLabel="Select downloads" label={selecting ? 'Done' : 'Select'} onPress={onSelect} variant="ghost" />}
      subtitle="Finished activity on this device" title="History" />
    {notice ? <Text color="textMuted">{notice}</Text> : null}
    <Inline gap="sm" style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.control, paddingHorizontal: 12 }}>
      <Icon color="textMuted" name="search" size={18} /><TextInput accessibilityLabel="Search history" onChangeText={setQuery} placeholder="Search history…"
        placeholderTextColor={colors.textMuted} style={{ color: colors.text, flex: 1, minHeight: 44 }} value={query} />
    </Inline>
    <ChoiceBar accessibilityLabel="History filters" choices={([
      { label: 'All', value: 'All' }, { label: 'Videos', value: 'Videos' },
      { label: 'Images', value: 'Images' }, { label: 'Audio', value: 'Audio' },
    ] as const)} onChange={setFilter} value={filter} />
    {selecting ? <Surface tone="surfaceMuted"><Stack gap="sm"><Text variant="label">{selectedIds.length} selected</Text>
      <Inline gap="sm" wrap><Button accessibilityLabel="Remove selected from history" label="Remove history" onPress={() => onDeleteSelected?.(selectedIds, 'history-only')} variant="secondary" />
        <Button accessibilityLabel="Delete selected from device and history" label="Delete files" onPress={() => onDeleteSelected?.(selectedIds, 'device-and-history')} variant="danger" /></Inline></Stack></Surface> : null}
    {filtered.length === 0 ? <EmptyState detail="Completed and failed downloads will appear here." icon="history" title="Nothing saved yet" />
      : Object.entries(groups).map(([date, group]) => <Stack gap="sm" key={date}><Text variant="label">{date}</Text>
        <Surface accessibilityLabel={`${date} downloads`} padding="md">{group.map((item, index) =>
          <HistoryItem item={item} key={item.id} last={index === group.length - 1} onOpen={onOpenItem} onRetry={onRetryItem}
            onShare={onShareItem} onToggle={onToggleItem} selected={selectedIds.includes(item.id)} selecting={selecting} />)}</Surface></Stack>)}
  </Stack></Screen>;
}
