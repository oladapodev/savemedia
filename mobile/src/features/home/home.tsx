import { useState } from 'react';
import { TextInput } from 'react-native';

import {
  Button,
  Icon,
  Inline,
  PageHeader,
  ProgressBar,
  Screen,
  Stack,
  Surface,
  Text,
  useTheme,
  type ButtonVariant,
} from '../../ui';
import { DownloadCard } from './download-card';
import type { DownloadSelection } from '../../downloads/types';

export type HomeScreenModel = {
  cardDetail: string;
  cardTitle: string;
  fileName?: string;
  jobId?: string;
  assetUri?: string;
  mediaChoices?: Array<{ id: string; label: string; selection: DownloadSelection }>;
  phase:
    | 'ready'
    | 'link_detected'
    | 'preparing'
    | 'selection_required'
    | 'duplicate'
    | 'downloading'
    | 'paused_offline'
    | 'complete'
    | 'failed';
  primaryAction: HomeAction;
  progress?: number;
  secondaryAction?: HomeAction;
  statusDetail: string;
  statusText: string;
};

export type HomeAction = {
  label: string;
  variant?: ButtonVariant;
};

export const readyHomeModel: HomeScreenModel = {
  cardDetail: 'Copy a public media link, then start when you are ready.',
  cardTitle: 'Save media from a link',
  phase: 'ready',
  primaryAction: { label: 'Paste & download' },
  statusDetail: 'Your clipboard is read only after you tap the button.',
  statusText: 'Ready to download',
};

export const downloadingHomeModel: HomeScreenModel = {
  cardDetail: 'Preparing a balanced-quality copy for your device.',
  cardTitle: 'Saving your media',
  fileName: 'summer-reel.mp4',
  phase: 'downloading',
  primaryAction: { label: 'Cancel download', variant: 'secondary' },
  progress: 42,
  statusDetail: 'Your download can continue in the background.',
  statusText: 'Download in progress',
};

type HomeScreenProps = {
  model: HomeScreenModel;
  onChooseMedia?: (selection: DownloadSelection) => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onSubmitUrl?: (url: string) => Promise<void> | void;
};

export function ProgressCard({ progress }: { progress: number }) {
  const roundedProgress = Math.round(progress);

  return (
    <Surface>
      <Stack gap="sm">
        <Text variant="label">Downloading</Text>
        <ProgressBar label="Download progress" value={roundedProgress} />
        <Text
          accessibilityElementsHidden
          color="textMuted"
          importantForAccessibility="no-hide-descendants"
          variant="caption"
        >
          Downloading · {roundedProgress}%
        </Text>
      </Stack>
    </Surface>
  );
}

export function StatusNotice({ model }: { model: HomeScreenModel }) {
  const icon = model.phase === 'failed'
    ? 'warning'
    : model.phase === 'complete'
      ? 'check'
      : model.phase === 'downloading'
        ? 'download'
        : 'info';

  return (
    <Surface accessibilityLabel={`Status: ${model.statusText}`} tone="surfaceMuted">
      <Inline gap="md">
        <Icon
          color={model.phase === 'failed' ? 'warning' : 'accent'}
          name={icon}
        />
        <Stack gap="xs" grow>
          <Text variant="label">{model.statusText}</Text>
          <Text color="textMuted" variant="caption">
            {model.statusDetail}
          </Text>
        </Stack>
      </Inline>
    </Surface>
  );
}

export function HomeScreen({
  model,
  onChooseMedia,
  onPrimaryAction,
  onSecondaryAction,
  onSubmitUrl,
}: HomeScreenProps) {
  const { colors } = useTheme();
  const [draftUrl, setDraftUrl] = useState('');

  const handlePaste = async () => {
    try {
      const clipboard = await (require('expo-clipboard') as typeof import('expo-clipboard')).getStringAsync();
      setDraftUrl(clipboard);
    } catch {
      setDraftUrl('');
    }
  };

  const handleSubmit = () => {
    const url = draftUrl.trim();
    if (!url) return;
    void onSubmitUrl?.(url);
  };

  return (
    <Screen scroll>
      <Stack gap="lg">
        <PageHeader
          subtitle="Private by default. No account required."
          title="iMediaSave"
        />
        <Surface tone="surfaceMuted">
          <Text variant="caption">
            Save only content you own or have permission to download.
          </Text>
        </Surface>
        <Surface level="raised" padding="lg">
          <Stack gap="md">
            <Stack gap="xs">
              <Text variant="label">Paste link</Text>
              <Text color="textMuted" variant="caption">
                Paste a public link or type one directly, then use the download button below.
              </Text>
            </Stack>
            <Inline gap="sm" wrap>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Paste a public link"
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: 14,
                  borderWidth: 1,
                  color: colors.text,
                  flex: 1,
                  minHeight: 52,
                  minWidth: 180,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
                value={draftUrl}
                onChangeText={setDraftUrl}
              />
              <Button label="Paste" onPress={handlePaste} variant="secondary" />
            </Inline>
            <Button
              disabled={!draftUrl.trim()}
              label="Download link"
              onPress={handleSubmit}
            />
          </Stack>
        </Surface>
        <DownloadCard
          model={model}
          onChooseMedia={onChooseMedia}
          onPrimaryAction={onPrimaryAction}
          onSecondaryAction={onSecondaryAction}
        />
        {typeof model.progress === 'number' ? (
          <ProgressCard progress={model.progress} />
        ) : null}
        <StatusNotice model={model} />
        <Text color="textMuted" variant="caption">
          Popular platforms and compatible public links.
        </Text>
      </Stack>
    </Screen>
  );
}
