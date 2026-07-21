import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useDownloads } from '../../src/downloads/context';
import { MediaDetailScreen } from '../../src/features/media/detail';
import { Button, Screen, Stack, Text } from '../../src/ui';

export default function PreviewRoute() {
  const downloads = useDownloads();
  const router = useRouter();
  const [quality, setQuality] = useState<'Balanced' | 'Original' | 'Audio'>(downloads.preview?.quality ?? 'Balanced');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!downloads.preview) return <Screen><Stack gap="lg"><Text accessibilityRole="header" variant="title">Preview unavailable</Text>
    <Text color="textMuted">Return Home and preview a supported public link.</Text><Button label="Return Home" onPress={() => router.replace('/')} /></Stack></Screen>;
  return <MediaDetailScreen busy={busy} error={error} item={{ ...downloads.preview, quality }} mode="preview" onBack={() => { downloads.clearPreview(); router.back(); }}
    onQualityChange={setQuality} onDownload={async () => {
      if (busy) return;
      setBusy(true);
      setError(undefined);
      try {
        const result = await downloads.confirmPreview(quality.toLowerCase() as 'balanced' | 'original' | 'audio');
        if (result.kind === 'started' || result.kind === 'selection_required') router.replace('/downloads');
        else if (result.kind === 'duplicate') router.replace(downloads.downloads.items.some(({ id }) => id === result.jobId) ? '/downloads' : '/history');
        else setError(result.kind === 'failed' ? result.job.failure?.message ?? 'The download could not be started.' : 'The link is no longer valid. Try previewing it again.');
      } finally { setBusy(false); }
    }} />;
}
