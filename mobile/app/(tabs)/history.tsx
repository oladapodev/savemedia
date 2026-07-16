import { useState } from 'react';

import { useDownloads } from '../../src/downloads/context';
import { HistoryScreen, type HistoryItemModel } from '../../src/features/history/history';

export default function HistoryRoute() {
  const downloads = useDownloads();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggle = (item: HistoryItemModel) => {
    setSelectedIds((current) => current.includes(item.id)
      ? current.filter((id) => id !== item.id)
      : [...current, item.id]);
  };

  return (
    <HistoryScreen
      items={downloads.history.items}
      notice={downloads.history.notice}
      onDeleteSelected={async (ids, choice) => {
        const outcome = await downloads.deleteHistory(ids, choice);
        setSelectedIds(outcome.failures.map(({ id }) => id));
        if (outcome.failures.length === 0) setSelecting(false);
      }}
      onOpenItem={async (item) => { if (item.assetUri) await downloads.open(item.assetUri); }}
      onRetryItem={async (item) => { await downloads.retry(item.id); }}
      onSelect={() => {
        setSelecting((value) => !value);
        setSelectedIds([]);
      }}
      onShareItem={async (item) => { if (item.assetUri) await downloads.share(item.assetUri); }}
      onToggleItem={toggle}
      selectedIds={selectedIds}
      selecting={selecting}
    />
  );
}
