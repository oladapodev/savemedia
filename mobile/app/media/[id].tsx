import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDownloads } from '../../src/downloads/context';
import { MediaDetailScreen } from '../../src/features/media/detail';
import { Button, Screen, Stack, Text } from '../../src/ui';

export default function SavedMediaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const downloads = useDownloads();
  const router = useRouter();
  const item = downloads.history.items.find((candidate) => candidate.id === id);
  if (!item || item.status !== 'Saved' || !item.assetUri) return <Screen><Stack gap="lg"><Text accessibilityRole="header" variant="title">Media unavailable</Text>
    <Text color="textMuted">This item may have been removed from the device or history.</Text><Button label="Back to History" onPress={() => router.replace('/history')} /></Stack></Screen>;
  return <MediaDetailScreen mode="saved" item={{ id: item.id, title: item.title, platform: item.sourceLabel,
    mediaType: item.mediaType ? item.mediaType[0].toUpperCase() + item.mediaType.slice(1) : 'Media', quality: item.quality ?? 'Balanced', dateLabel: item.dateLabel,
    ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}), ...(item.sizeLabel ? { sizeLabel: item.sizeLabel } : {}) }} onBack={() => router.back()}
    onOpen={() => { void downloads.open(item.assetUri!); }} onShare={() => { void downloads.share(item.assetUri!); }} />;
}
