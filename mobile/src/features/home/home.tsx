import {
  Icon,
  Inline,
  PageHeader,
  ProgressBar,
  Screen,
  Stack,
  Surface,
  Text,
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
}: HomeScreenProps) {
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
