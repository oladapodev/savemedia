import { useState } from 'react';
import { Image, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Inline, ProgressBar, Reveal, Screen, Stack, Surface, Text, radius, space, useTheme, type ButtonVariant } from '../../ui';
import type { DownloadSelection } from '../../downloads/types';
import { DownloadCard } from './download-card';
import { PromoCarousel } from './promo-carousel';

export type HomeScreenModel = {
  cardDetail: string; cardTitle: string; fileName?: string; jobId?: string; assetUri?: string;
  mediaChoices?: Array<{ id: string; label: string; selection: DownloadSelection }>;
  phase: 'ready' | 'link_detected' | 'preparing' | 'selection_required' | 'duplicate' | 'downloading' | 'paused_offline' | 'complete' | 'failed';
  primaryAction: HomeAction; progress?: number; secondaryAction?: HomeAction; statusDetail: string; statusText: string;
};
export type HomeAction = { label: string; variant?: ButtonVariant };

export const readyHomeModel: HomeScreenModel = {
  cardDetail: 'Copy a public media link, then start when you are ready.', cardTitle: 'Save media from a link', phase: 'ready',
  primaryAction: { label: 'Paste & download' }, statusDetail: 'Your clipboard is read only after you tap Paste.', statusText: 'Ready to download',
};
export const downloadingHomeModel: HomeScreenModel = {
  cardDetail: 'Preparing a balanced-quality copy for your device.', cardTitle: 'Saving your media', fileName: 'summer-reel.mp4',
  phase: 'downloading', primaryAction: { label: 'Cancel download', variant: 'secondary' }, progress: 42,
  statusDetail: 'Your download can continue in the background.', statusText: 'Download in progress',
};

type HomeScreenProps = {
  model: HomeScreenModel;
  onChooseMedia?: (selection: DownloadSelection) => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onSubmitUrl?: (url: string) => Promise<void> | void;
};

function Benefit({ icon, label, tone }: { icon: 'bolt' | 'check' | 'lock'; label: string; tone: 'accent' | 'success' | 'warning' }) {
  const { colors } = useTheme();
  return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0, paddingVertical: space.sm }}>
    <Stack gap="xs" style={{ alignItems: 'center' }}>
      <Icon color={tone} name={icon} size={21} />
      <Text style={{ color: colors.text, textAlign: 'center' }} variant="caption">{label}</Text>
    </Stack>
  </View>;
}

function Step({ detail, number, title }: { detail: string; number: number; title: string }) {
  const { colors } = useTheme();
  return <Inline gap="md" style={{ alignItems: 'flex-start' }}>
    <View style={{ alignItems: 'center', backgroundColor: colors.accent, borderRadius: 16, height: 30, justifyContent: 'center', width: 30 }}>
      <Text color="heroText" variant="label">{number}</Text>
    </View>
    <Stack gap="xs" grow><Text variant="label">{title}</Text><Text color="textMuted" variant="caption">{detail}</Text></Stack>
  </Inline>;
}

export function getHomeFormDirection(width: number): 'column' | 'row' {
  return width < 360 ? 'column' : 'row';
}

export function getHomeHeaderTopPadding(topInset: number) {
  return topInset + space.sm;
}

export function isPreviewableUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function ProgressCard({ progress }: { progress: number }) {
  const roundedProgress = Math.round(progress);
  return <Surface><Stack gap="sm"><Text variant="label">Downloading</Text>
    <ProgressBar label="Download progress" value={roundedProgress} />
    <Text accessibilityElementsHidden color="textMuted" importantForAccessibility="no-hide-descendants" variant="caption">
      Downloading · {roundedProgress}%
    </Text>
  </Stack></Surface>;
}

export function StatusNotice({ model }: { model: HomeScreenModel }) {
  const icon = model.phase === 'failed' ? 'warning' : model.phase === 'complete' ? 'check' : model.phase === 'downloading' ? 'download' : 'info';
  return <Surface accessibilityLabel={`Status: ${model.statusText}`} tone="surfaceMuted"><Inline gap="md">
    <Icon color={model.phase === 'failed' ? 'warning' : 'accent'} name={icon} />
    <Stack gap="xs" grow><Text variant="label">{model.statusText}</Text><Text color="textMuted" variant="caption">{model.statusDetail}</Text></Stack>
  </Inline></Surface>;
}

export function HomeScreen({ model, onChooseMedia, onPrimaryAction, onSecondaryAction, onSubmitUrl }: HomeScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const formDirection = getHomeFormDirection(width);
  const [url, setUrl] = useState('');
  const [pasting, setPasting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [inspecting, setInspecting] = useState(false);

  const paste = async () => {
    setPasting(true);
    setFormError(undefined);
    try {
      const value = await (require('expo-clipboard') as typeof import('expo-clipboard')).getStringAsync();
      setUrl(value.trim());
    } catch {
      setFormError('Could not read your clipboard. Paste the link manually and try again.');
    } finally { setPasting(false); }
  };

  const submit = async () => {
    const value = url.trim();
    if (inspecting) return;
    if (!isPreviewableUrl(value)) {
      setFormError('Enter a complete public link beginning with http:// or https://.');
      return;
    }
    setFormError(undefined);
    setInspecting(true);
    try {
      await onSubmitUrl?.(value);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not preview that link. Try again.');
    } finally {
      setInspecting(false);
    }
  };

  return <Screen contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0 }} edges={['left', 'right']} scroll>
    <Reveal>
      <View testID="home-header" style={{ paddingHorizontal: space.md }}>
        <View testID="home-hero" style={{ alignItems: 'center', backgroundColor: colors.accent,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          overflow: 'hidden', paddingBottom: 72, paddingHorizontal: space.lg, paddingTop: getHomeHeaderTopPadding(top) }}>
          <Stack gap="md" style={{ alignItems: 'center', maxWidth: 360, width: '100%' }}>
            <View testID="home-logo-tile" style={{ alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18,
              height: 76, justifyContent: 'center', width: 76 }}>
              <Image accessibilityLabel="iMediaSave logo" accessibilityRole="image" source={require('../../../assets/brand-logo.png')}
                style={{ borderRadius: radius.control, height: 58, width: 58 }} />
            </View>
            <Stack gap="xs" style={{ alignItems: 'center' }}>
              <Text accessibilityRole="header" color="heroText" style={{ textAlign: 'center' }} variant="display">iMediaSave</Text>
              <Text color="heroText" style={{ opacity: 0.88, textAlign: 'center' }} variant="body">Save public media in seconds</Text>
            </Stack>
          </Stack>
        </View>
        <Surface padding="md" testID="home-download-card" style={{ borderRadius: radius.sheet, marginHorizontal: space.sm,
          marginTop: -44, width: 'auto' }}>
          <Stack gap="sm">
            <View style={{ flexDirection: formDirection, gap: space.sm, width: '100%' }}>
              <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={(value) => { setUrl(value); setFormError(undefined); }} placeholder="Paste link here…"
                placeholderTextColor={colors.textMuted} value={url}
                style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.control, borderWidth: 1, color: colors.text,
                  flex: formDirection === 'row' ? 1 : undefined, minHeight: 48, minWidth: 0, paddingHorizontal: 13,
                  width: formDirection === 'column' ? '100%' : undefined }} />
              <Button label="Paste" loading={pasting} onPress={paste} variant="secondary"
                style={{ alignSelf: 'stretch', minWidth: formDirection === 'row' ? 72 : 0 }} />
            </View>
            <Button disabled={!url.trim() || inspecting} icon="download" label="Preview download" loading={inspecting} onPress={() => { void submit(); }} />
            {formError ? <Text accessibilityRole="alert" color="danger" variant="caption">{formError}</Text> : null}
          </Stack>
        </Surface>
      </View>
    </Reveal>

    <Stack gap="xl" style={{ padding: space.md }}>
      {model.phase !== 'ready' ? <Reveal delay={20}><Stack gap="md">
        <DownloadCard model={model} onChooseMedia={onChooseMedia} onPrimaryAction={onPrimaryAction} onSecondaryAction={onSecondaryAction} />
        {typeof model.progress === 'number' ? <ProgressCard progress={model.progress} /> : null}
        <StatusNotice model={model} />
      </Stack></Reveal> : null}
      <Reveal delay={20}><Inline gap="sm" justify="between">
        <Benefit icon="bolt" label="Fast Downloads" tone="warning" />
        <Benefit icon="check" label="High Quality" tone="success" />
        <Benefit icon="lock" label="100% Secure" tone="accent" />
      </Inline></Reveal>

      <Reveal delay={40}><PromoCarousel /></Reveal>

      <Reveal delay={40}><Stack gap="lg"><Stack gap="xs"><Text variant="title">How it works</Text><Text color="textMuted" variant="caption">Simple steps to download supported public media.</Text></Stack>
        <Step detail="Copy a public link from a supported platform." number={1} title="Copy link" />
        <Step detail="Paste the link and review the real media preview." number={2} title="Paste & preview" />
        <Step detail="Choose quality and save it to your device." number={3} title="Download" />
      </Stack></Reveal>
      <Reveal delay={40}><Text color="textMuted" variant="caption">Save only content you own or have permission to download.</Text></Reveal>
    </Stack>
  </Screen>;
}
