import { Image, View, useWindowDimensions } from 'react-native';
import { Button, ChoiceBar, Divider, Icon, Inline, PageHeader, Screen, Stack, Surface, Text, radius, space, useTheme } from '../../ui';

export type MediaDetailModel = {
  id: string; title: string; platform: string; mediaType: string; thumbnailUrl?: string;
  quality: 'Balanced' | 'Original' | 'Audio'; sizeLabel?: string; dateLabel?: string;
};

export function getDetailActionDirection(width: number): 'column' | 'row' {
  return width < 360 ? 'column' : 'row';
}

export function MediaDetailScreen({ busy = false, error, item, mode, onBack, onDownload, onOpen, onQualityChange, onShare }: {
  busy?: boolean; error?: string;
  item: MediaDetailModel; mode: 'preview' | 'saved'; onBack?: () => void; onDownload?: () => void;
  onOpen?: () => void; onQualityChange?: (quality: MediaDetailModel['quality']) => void; onShare?: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const actionDirection = getDetailActionDirection(width);
  return <Screen scroll><Stack gap="lg">
    <PageHeader action={onBack ? <Button label="Back" onPress={onBack} variant="ghost" /> : undefined} title={mode === 'preview' ? 'Download' : 'Media details'} />
    <View style={{ alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.card, height: 230, justifyContent: 'center', overflow: 'hidden' }}>
      {item.thumbnailUrl ? <Image accessibilityLabel={`${item.title} preview`} resizeMode="cover" source={{ uri: item.thumbnailUrl }} style={{ height: '100%', width: '100%' }} />
        : <Icon color="accent" name="image" size={42} />}
    </View>
    <Stack gap="xs"><Text variant="title">{item.title}</Text><Text color="textMuted">{item.platform} · {item.mediaType}</Text></Stack>
    {error ? <Surface tone="dangerSoft"><Text color="danger">{error}</Text></Surface> : null}
    <Surface><Stack gap="md">
      <Inline justify="between"><Text color="textMuted">Quality</Text><Text color="accent" variant="label">{item.quality}</Text></Inline>
      {mode === 'preview' ? <ChoiceBar accessibilityLabel="Media quality choices" choices={[
        { label: 'Balanced', value: 'Balanced' }, { label: 'Original', value: 'Original' }, { label: 'Audio', value: 'Audio' },
      ]} onChange={(quality) => onQualityChange?.(quality)} value={item.quality} /> : null}
      {item.sizeLabel ? <><Divider /><Inline justify="between"><Text color="textMuted">File size</Text><Text variant="label">{item.sizeLabel}</Text></Inline></> : null}
      {item.dateLabel ? <><Divider /><Inline justify="between"><Text color="textMuted">Saved</Text><Text variant="label">{item.dateLabel}</Text></Inline></> : null}
    </Stack></Surface>
    {mode === 'preview' ? <Button accessibilityLabel="Download media" icon="download" label="Download" loading={busy} onPress={onDownload} />
      : <View style={{ flexDirection: actionDirection, gap: space.sm, width: '100%' }}>
        <Button accessibilityLabel="Share media" icon="share" label="Share" onPress={onShare}
          style={{ flex: actionDirection === 'row' ? 1 : undefined, width: actionDirection === 'column' ? '100%' : undefined }} variant="secondary" />
        <Button accessibilityLabel="Open in gallery" icon="image" label="Open in Gallery" onPress={onOpen}
          style={{ flex: actionDirection === 'row' ? 1 : undefined, width: actionDirection === 'column' ? '100%' : undefined }} variant="secondary" />
      </View>}
  </Stack></Screen>;
}
