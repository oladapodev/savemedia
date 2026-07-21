import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useDownloads } from '../src/downloads/context';
import type { StartResult } from '../src/downloads/controller';
import {
  clearIncomingShareOnce,
  consumeIncomingShareOnce,
} from '../src/share/incoming-consumer';
import { normalizeIncomingShare } from '../src/share/incoming';
import { useIncomingShareAdapter } from '../src/platform/incoming-share';
import { Button, Screen, Stack, Surface, Text } from '../src/ui';

type ConsumptionOutcome =
  | { kind: 'navigate'; title: string; detail: string; label: string; destination?: '/media/preview' | '/downloads' | '/history' }
  | { kind: 'rejected'; title: string; detail: string; label: string };

const SHARE_CONFIRMATION_MS = 450;

function outcomeFromStart(result: StartResult, duplicateInHistory = false): ConsumptionOutcome {
  if (result.kind === 'failed') {
    return {
      kind: 'rejected',
      title: 'Cannot save this share',
      label: 'Share rejected',
      detail: result.job.failure?.message ?? 'The shared media could not be saved.',
    };
  }
  if (result.kind === 'invalid_url') {
    return {
      kind: 'rejected', title: 'Cannot save this share', label: 'Share rejected',
      detail: 'The shared link is not a public HTTP(S) URL.',
    };
  }
  if (result.kind === 'selection_required') {
    return {
      kind: 'navigate', title: 'Choose shared media', label: 'Selection required',
      detail: 'Choose one shared media item in Downloads.', destination: '/downloads',
    };
  }
  if (result.kind === 'duplicate') {
    return {
      kind: 'navigate', title: 'Already saved', label: 'Duplicate',
      detail: duplicateInHistory ? 'This media is already in your history.' : 'This media is already being handled.',
      destination: duplicateInHistory ? '/history' : '/downloads',
    };
  }
  if (result.job.status === 'complete') {
    return {
      kind: 'navigate', title: 'Saved to device', label: 'Saved',
      detail: 'The shared media is saved in your library.', destination: '/history',
    };
  }
  return {
    kind: 'navigate', title: 'Download started', label: 'Queued',
    detail: 'Your shared link is queued in Downloads.', destination: '/downloads',
  };
}

export default function ShareRoute() {
  const incoming = useIncomingShareAdapter();
  const downloads = useDownloads();
  const router = useRouter();
  const normalized = useMemo(() => normalizeIncomingShare(incoming), [
    incoming.error,
    incoming.isResolving,
    incoming.resolvedSharedPayloads,
    incoming.sharedPayloads,
    incoming.sourceKey,
    incoming.sourceOwnership,
  ]);
  const [outcome, setOutcome] = useState<ConsumptionOutcome | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const key = normalized.kind === 'url' || normalized.kind === 'media' || normalized.kind === 'rejected'
    ? normalized.key
    : null;

  useEffect(() => {
    setClearError(null);
  }, [key]);

  useEffect(() => {
    if (normalized.kind === 'empty') {
      router.replace('/');
      return;
    }
    if (normalized.kind === 'pending') return;

    let active = true;
    const operation = normalized.kind === 'rejected'
      ? consumeIncomingShareOnce(normalized.key, async () => {
          await downloads.discardIncomingShare(normalized.stagingUris);
          return {
            kind: 'rejected' as const,
            title: 'Cannot save this share',
            label: 'Share rejected',
            detail: normalized.message,
          };
        })
      : normalized.kind === 'url'
        ? consumeIncomingShareOnce(normalized.key, async () => {
            if (downloads.settings.smartAutoSave) {
              const result = await downloads.startSharedUrl(normalized.url);
              return outcomeFromStart(result, result.kind === 'duplicate' && downloads.history.items.some(({ id }) => id === result.jobId));
            }
            const previewed = await downloads.inspectUrl(normalized.url);
            return previewed
              ? { kind: 'navigate' as const, title: 'Preview ready', label: 'Ready', detail: 'Review the media before downloading.', destination: '/media/preview' as const }
              : { kind: 'rejected' as const, title: 'Cannot preview this share', label: 'Share rejected', detail: 'The shared link could not be previewed.' };
          })
        : consumeIncomingShareOnce(normalized.key, async () => (
            downloads.saveSharedFiles(normalized.items).then((result) => outcomeFromStart(result,
              result.kind === 'duplicate' && downloads.history.items.some(({ id }) => id === result.jobId)))
          ));
    operation.then((next) => {
      if (active) setOutcome(next);
    }).catch((error: unknown) => {
      if (active) {
        setOutcome({
          kind: 'rejected',
          title: 'Cannot save this share',
          label: 'Share rejected',
          detail: error instanceof Error ? error.message : 'The shared content could not be saved.',
        });
      }
    });
    return () => { active = false; };
  }, [downloads, normalized, router]);

  useEffect(() => {
    if (!outcome || !key || clearError) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      clearIncomingShareOnce(key, () => incoming.clearSharedPayloads())
        .then(() => {
          if (active && outcome.kind === 'navigate') router.replace(outcome.destination ?? '/');
        })
        .catch((error: unknown) => {
          if (active) {
            setClearError(error instanceof Error
              ? error.message
              : 'The shared media queue could not be cleared.');
          }
        });
    }, SHARE_CONFIRMATION_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [clearError, incoming, key, outcome, router]);

  const rejected = outcome?.kind === 'rejected' || Boolean(clearError);
  const title = clearError
      ? 'Shared media still pending'
      : outcome
      ? outcome.title
      : normalized.kind === 'pending'
        ? 'Opening shared media'
        : 'Saving shared media';
  const detail = clearError ?? outcome?.detail
    ?? (normalized.kind === 'pending'
      ? 'Checking the shared content…'
      : 'Validating and saving the shared content…');

  return (
    <Screen accessibilityLabel="Incoming share">
      <Stack gap="lg" grow>
        <Text accessibilityRole="header" variant="title">{title}</Text>
        <Surface accessibilityLiveRegion="polite" accessibilityRole="summary">
          <Stack gap="sm">
            <Text variant="label">{clearError ? 'Cleanup required' : outcome?.label ?? 'Saving'}</Text>
            <Text color="textMuted" variant="body">{detail}</Text>
          </Stack>
        </Surface>
        {clearError ? (
          <Button label="Retry cleanup" onPress={() => setClearError(null)} />
        ) : rejected ? (
          <Button label="Return Home" onPress={() => router.replace('/')} />
        ) : null}
      </Stack>
    </Screen>
  );
}
