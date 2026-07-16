import { useState } from 'react';

import { useDownloads } from '../../src/downloads/context';
import { HistoryScreen, type HistoryItemModel } from '../../src/features/history/history';

export default function HistoryRoute() {
  const downloads = useDownloads();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const runAction = (action: () => Promise<unknown> | void) => {
    try {
      void Promise.resolve(action()).catch(() => undefined);
    } catch {}
  };
  const toggle = (item: HistoryItemModel) => {
    setSelectedIds((current) => current.includes(item.id)
      ? current.filter((id) => id !== item.id)
      : [...current, item.id]);
  };

  return (
    <HistoryScreen
      items={downloads.history.items}
      notice={downloads.history.notice}
      onDeleteSelected={(ids, choice) => {
        runAction(async () => {
          const outcome = await downloads.deleteHistory(ids, choice);
          setSelectedIds(outcome.failures.map(({ id }) => id));
          if (outcome.failures.length === 0) setSelecting(false);
        });
      }}
      onOpenItem={(item) => { if (item.assetUri) runAction(() => downloads.open(item.assetUri)); }}
      onRetryItem={(item) => { runAction(() => downloads.retry(item.id)); }}
      onSelect={() => {
        setSelecting((value) => !value);
        setSelectedIds([]);
      }}
      onShareItem={(item) => { if (item.assetUri) runAction(() => downloads.share(item.assetUri)); }}
      onToggleItem={toggle}
      selectedIds={selectedIds}
      selecting={selecting}
    />
  );
}
