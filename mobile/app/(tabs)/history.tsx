import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useDownloads } from '../../src/downloads/context';
import { HistoryScreen, type HistoryItemModel } from '../../src/features/history/history';

export default function HistoryRoute() {
  const downloads = useDownloads();
  const router = useRouter();
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
      onOpenItem={(item) => {
        router.push(`/media/${item.id}`);
      }}
      onRetryItem={(item) => { runAction(() => downloads.retry(item.id)); }}
      onSelect={() => {
        setSelecting((value) => !value);
        setSelectedIds([]);
      }}
      onShareItem={(item) => {
        const assetUri = item.assetUri;
        if (assetUri) runAction(() => downloads.share(assetUri));
      }}
      onToggleItem={toggle}
      selectedIds={selectedIds}
      selecting={selecting}
    />
  );
}
