import { Button, EmptyState, Inline, MediaThumbnail, PageHeader, ProgressBar, Screen, Stack, Surface, Text } from '../../ui';
import type { DownloadSelection } from '../../downloads/types';

export type ActiveDownloadItemModel = {
  id: string; title: string; platform: string; status: string; progress?: number; thumbnailUrl?: string;
  choices?: Array<{ id: string; label: string; selection: DownloadSelection }>;
};

export function DownloadsScreen({ items, notice, onCancel, onChoose }: {
  items: ActiveDownloadItemModel[]; notice?: string; onCancel?: (item: ActiveDownloadItemModel) => void;
  onChoose?: (item: ActiveDownloadItemModel, selection: DownloadSelection) => void;
}) {
  return <Screen edges={['top', 'left', 'right']} scroll><Stack gap="lg">
    <PageHeader subtitle="Active transfers on this device" title="Downloads" />
    {notice ? <Text color="textMuted">{notice}</Text> : null}
    {items.length === 0 ? <EmptyState detail="Paste a link on Home to start a download." icon="download" title="No active downloads" />
      : items.map((item) => <Surface key={item.id}><Stack gap="md">
      <Inline gap="md" justify="between"><MediaThumbnail fallbackIcon="download" label={`${item.title} thumbnail`}
        style={{ height: 52, width: 52 }} uri={item.thumbnailUrl} /><Stack gap="xs" grow><Text numberOfLines={1} variant="label">{item.title}</Text>
        <Text color="textMuted" variant="caption">{item.platform} · {item.status}</Text></Stack>
        <Button accessibilityLabel={`Cancel ${item.title}`} label="Cancel" onPress={() => onCancel?.(item)} variant="ghost" />
      </Inline>
      {typeof item.progress === 'number' ? <Stack gap="xs"><Inline justify="between"><Text color="textMuted" variant="caption">Downloading</Text>
        <Text color="accent" variant="label">{item.progress}%</Text></Inline><ProgressBar label={`${item.title} progress`} value={item.progress} /></Stack> : null}
      {item.choices?.length ? <Stack gap="sm"><Text variant="label">Choose what to save</Text>
        {item.choices.map((choice) => <Button key={choice.id} label={choice.label} onPress={() => onChoose?.(item, choice.selection)} variant="secondary" />)}
      </Stack> : null}
    </Stack></Surface>)}
  </Stack></Screen>;
}
