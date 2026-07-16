import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { createApi } from '../api/client';
import type { Fetcher, MediaApi } from '../api/types';
import { deleteDownload, type HistoryDeleteChoice } from '../history/delete';
import { useRepositories } from '../history/db';
import { asDownloadHistoryRepo, type HistoryEntry } from '../history/repo';
import {
  defaultSettings as repositoryDefaults,
  type Settings,
  type SettingsInput,
} from '../settings/repo';
import type { HistoryItemModel } from '../features/history/history';
import {
  readyHomeModel,
  type HomeScreenModel,
} from '../features/home/home';
import type { SettingsModel } from '../features/settings/settings';
import { OwnershipNotice } from '../features/legal/notice';
import {
  acceptOwnershipNotice,
  hasAcceptedOwnershipNotice,
} from '../features/legal/ownership';
import { AppThemeProvider } from '../ui';
import { createDownloadController, type DownloadController, type StartResult } from './controller';
import { downloadProgressPercent } from './progress';
import type {
  BackgroundDownloads,
  DownloadNotifications,
  MediaFiles,
  NetworkStatus,
} from './ports';
import type { DirectMediaInput, DownloadJob, DownloadSelection, FailureReason } from './types';

export type DownloadProviderDependencies = {
  api?: MediaApi;
  background?: BackgroundDownloads;
  clipboard?: { getStringAsync(): Promise<string> };
  fetcher?: Fetcher;
  files?: MediaFiles;
  notifications?: DownloadNotifications;
  network?: NetworkStatus;
  now?: () => number;
  id?: () => string;
};

export type DownloadContextValue = {
  home: HomeScreenModel;
  history: { items: HistoryItemModel[]; notice?: string };
  settings: SettingsModel;
  pasteAndDownload(): Promise<PasteAndDownloadResult>;
  startSharedUrl(url: string): Promise<StartResult>;
  saveSharedFiles(files: readonly DirectMediaInput[]): Promise<StartResult>;
  discardIncomingShare(uris: readonly string[]): Promise<void>;
  downloadAgain(): Promise<StartResult | undefined>;
  chooseMedia(jobId: string, selection: DownloadSelection): Promise<DownloadJob | undefined>;
  cancel(jobId: string): Promise<void>;
  retry(jobId: string): ReturnType<DownloadController['retry']>;
  deleteHistory(ids: string[], choice: HistoryDeleteChoice): Promise<DeleteHistoryOutcome>;
  updateSettings(patch: Partial<Pick<Settings, 'quality' | 'smartAutoSave' | 'alerts' | 'allowCellular' | 'themeMode'>>): Promise<void>;
  cleanupTemporary(): Promise<void>;
  requestSaveLocationAccess(): Promise<void>;
  share(assetUri: string): Promise<void>;
  open(assetUri: string): Promise<void>;
};

export type PasteAndDownloadResult = StartResult | { kind: 'action_failed' };

export type DeleteHistoryOutcome = {
  deletedIds: string[];
  failures: Array<{ id: string; kind: 'permission_error' | 'device_error' | 'history_error'; deviceDeleted?: boolean }>;
};

type HomeTransient =
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'duplicate'; jobId: string; assetUri?: string };

type InitializationPhase =
  | 'loading-settings'
  | 'awaiting-acceptance'
  | 'initializing-jobs'
  | 'ready'
  | 'failed'
  | 'unmounted';

type ReadinessWaiter = {
  resolve(): void;
  reject(error: Error): void;
};

const DownloadContext = createContext<DownloadContextValue | null>(null);

function createId(): string {
  return `download-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function settingsModel(settings: Settings, notice?: string): SettingsModel {
  return {
    allowCellular: settings.allowCellular,
    appVersion: '1.0.0',
    notifications: settings.alerts,
    quality: settings.quality === 'balanced'
      ? 'Balanced'
      : settings.quality === 'original' ? 'Original' : 'Audio',
    saveLocation: 'Photos & media library',
    smartAutoSave: settings.smartAutoSave,
    ...(notice ? { notice } : {}),
  };
}

function historyModel(entry: HistoryEntry): HistoryItemModel {
  const media = entry.mimeType.startsWith('image/')
    ? 'Image'
    : entry.mimeType.startsWith('audio/') ? 'Audio' : 'Video';
  const size = entry.sizeBytes === null ? '' : ` · ${Math.max(1, Math.round(entry.sizeBytes / 1_048_576))} MB`;
  return {
    id: entry.id,
    title: entry.filename,
    sourceLabel: entry.platform.charAt(0).toUpperCase() + entry.platform.slice(1),
    detail: `${media}${size}`,
    dateLabel: entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : 'Pending',
    status: entry.status === 'failed' ? 'Failed' : 'Saved',
    ...(entry.deviceAssetRef ? { assetUri: entry.deviceAssetRef } : {}),
    sourceUrl: entry.sourceUrl,
  };
}

function homeModel(jobs: DownloadJob[], transient: HomeTransient | null): HomeScreenModel {
  if (transient?.kind === 'invalid') {
    return {
      phase: 'failed', cardTitle: 'Invalid link', cardDetail: 'Copy a supported public media URL and try again.',
      primaryAction: { label: 'Paste another link' }, statusText: 'No downloadable link found',
      statusDetail: 'Clipboard text is only read after you tap the action.',
    };
  }
  if (transient?.kind === 'error') {
    return {
      phase: 'failed', cardTitle: 'Action could not be completed', cardDetail: transient.message,
      primaryAction: { label: 'Paste another link' }, statusText: 'Something went wrong', statusDetail: transient.message,
    };
  }
  if (transient?.kind === 'duplicate') {
    return {
      phase: 'duplicate', jobId: transient.jobId, ...(transient.assetUri ? { assetUri: transient.assetUri } : {}),
      cardTitle: 'Already downloaded', cardDetail: 'This media already exists in your history.',
      primaryAction: { label: transient.assetUri ? 'View' : 'Download again' },
      ...(transient.assetUri ? { secondaryAction: { label: 'Download again', variant: 'secondary' as const } } : {}),
      statusText: 'Duplicate link', statusDetail: 'View the saved copy or explicitly download it again.',
    };
  }
  const job = [...jobs].reverse().find((candidate) => candidate.status !== 'cancelled');
  if (!job) return readyHomeModel;
  const title = job.preview?.title ?? job.transfer?.filename ?? 'Your media';
  const progress = downloadProgressPercent(job.progress);

  switch (job.status) {
    case 'selection_required':
      return {
        jobId: job.id,
        phase: 'selection_required',
        cardTitle: 'Choose media',
        cardDetail: 'Select the item you want to save.',
        mediaChoices: job.preview.items.flatMap((item, index) => item.variants.map((variant) => ({
          id: variant.id,
          label: `${item.mediaType.charAt(0).toUpperCase() + item.mediaType.slice(1)} ${index + 1}`,
          selection: {
            itemId: item.id,
            quality: item.mediaType === 'audio' ? 'audio' : item.mediaType === 'image' ? 'original' : 'balanced',
            variant,
          },
        }))),
        primaryAction: { label: 'Cancel', variant: 'secondary' },
        statusText: 'Selection required',
        statusDetail: 'Nothing downloads until you choose an item.',
      };
    case 'downloading':
      return {
        jobId: job.id,
        fileName: job.transfer?.filename,
        ...(progress === undefined ? {} : { progress }),
        phase: 'downloading',
        cardTitle: 'Saving your media',
        cardDetail: title,
        primaryAction: { label: 'Cancel download', variant: 'secondary' },
        statusText: 'Download in progress',
        statusDetail: 'The transfer can continue in the background when the platform permits.',
      };
    case 'paused_offline':
      return {
        jobId: job.id,
        phase: 'paused_offline',
        cardTitle: 'Download paused',
        cardDetail: title,
        primaryAction: { label: 'Retry now' },
        secondaryAction: { label: 'Cancel download', variant: 'secondary' },
        statusText: 'Waiting for a connection',
        statusDetail: 'Reconnect before retrying this download.',
      };
    case 'complete':
      return {
        jobId: job.id,
        assetUri: job.assetUri,
        fileName: job.transfer?.filename,
        phase: 'complete',
        cardTitle: 'Saved to your device',
        cardDetail: `${job.transfer?.filename ?? title} is ready.`,
        primaryAction: { label: 'View' },
        secondaryAction: { label: 'Share', variant: 'secondary' },
        statusText: 'Download complete',
        statusDetail: 'The file is available on this device.',
      };
    case 'failed':
      const failureMessage: Partial<Record<FailureReason, string>> = {
        unsupported: 'This provider or link type is not supported.',
        private: 'Private media cannot be downloaded.',
        not_found: 'The media could not be found or is no longer available.',
        permission: 'Allow media-library access to save the completed download.',
        offline: 'Connect to the internet and retry.',
      };
      return {
        jobId: job.id,
        phase: 'failed',
        cardTitle: 'Could not save media',
        cardDetail: failureMessage[job.failure.reason] ?? job.failure.message ?? 'The download could not be completed.',
        primaryAction: { label: 'Retry' },
        secondaryAction: { label: 'Try another link', variant: 'secondary' },
        statusText: 'Download failed',
        statusDetail: job.failure.reason === 'permission'
          ? 'Allow media access to export the completed temporary file.'
          : 'You can retry or paste another public link.',
      };
    case 'queued':
    case 'inspecting':
    case 'preparing':
    case 'exporting':
      return {
        jobId: job.id,
        fileName: job.transfer?.filename,
        phase: 'preparing',
        cardTitle: job.status === 'exporting' ? 'Saving to your library' : 'Preparing download',
        cardDetail: title,
        primaryAction: { label: 'Cancel', variant: 'secondary' },
        statusText: job.status === 'exporting' ? 'Exporting' : 'Preparing',
        statusDetail: 'This usually takes a moment.',
      };
  }
}

function preservedTemporaryUris(jobs: readonly DownloadJob[]): string[] {
  return jobs.flatMap((job) => {
    const directSelectionUris = job.status === 'selection_required'
      ? job.preview.items.flatMap((item) => item.variants)
        .filter((variant) => variant.transfer?.sourceKind === 'device-share')
        .map((variant) => variant.transfer!.downloadUrl)
      : [];
    return [
      job.temporaryUri,
      job.status === 'failed' ? job.recovery?.temporaryUri : undefined,
      ...directSelectionUris,
    ];
  }).filter((uri): uri is string => Boolean(uri));
}

function settingsInput(settings: Settings): SettingsInput {
  return {
    quality: settings.quality,
    smartAutoSave: settings.smartAutoSave,
    alerts: settings.alerts,
    allowCellular: settings.allowCellular,
    themeMode: settings.themeMode,
    metadata: settings.metadata,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function providerUnmountedError(): Error {
  return new Error('Download provider unmounted before initialization completed.');
}

function isFailedPhase(phase: InitializationPhase): boolean {
  return phase === 'failed';
}

export function DownloadProvider({
  children,
  dependencies = {},
}: PropsWithChildren<{ dependencies?: DownloadProviderDependencies }>) {
  const repositories = useRepositories();
  const background = dependencies.background
    ?? (require('../platform/background') as typeof import('../platform/background')).createDefaultBackgroundDownloads();
  const files = dependencies.files
    ?? (require('../files/expo-media') as typeof import('../files/expo-media')).expoMediaFiles;
  const nativeNotifications = dependencies.notifications
    ?? (require('../notifications/expo-downloads') as typeof import('../notifications/expo-downloads')).expoDownloadNotifications;
  const network = dependencies.network
    ?? (require('./expo-network') as typeof import('./expo-network')).expoNetworkStatus;
  const settingsRef = useRef<Settings>({
    quality: repositoryDefaults.quality,
    smartAutoSave: repositoryDefaults.smartAutoSave,
    alerts: repositoryDefaults.alerts,
    allowCellular: repositoryDefaults.allowCellular,
    themeMode: repositoryDefaults.themeMode,
    metadataVersion: repositoryDefaults.metadataVersion,
    metadata: { ...repositoryDefaults.metadata },
  });
  const [settings, setSettings] = useState<Settings>(settingsRef.current);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [homeTransient, setHomeTransient] = useState<HomeTransient | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string>();
  const [settingsNotice, setSettingsNotice] = useState<string>();
  const [ownershipNoticeVisible, setOwnershipNoticeVisible] = useState(false);
  const [ownershipNoticeAccepting, setOwnershipNoticeAccepting] = useState(false);
  const [ownershipNoticeError, setOwnershipNoticeError] = useState<string>();
  const [initializationError, setInitializationError] = useState<string>();
  const [initializationRetrying, setInitializationRetrying] = useState(false);
  const lastClipboardText = useRef<string | undefined>(undefined);
  const mountedRef = useRef(false);
  const phaseRef = useRef<InitializationPhase>('loading-settings');
  const settingsLoadedRef = useRef(false);
  const jobProcessingAllowedRef = useRef(false);
  const readinessWaitersRef = useRef<ReadinessWaiter[]>([]);
  const initializationRunRef = useRef<Promise<void> | null>(null);
  const settingsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const acceptanceInFlightRef = useRef(false);

  const api = useMemo(
    () => dependencies.api ?? createApi({
      baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
      ...(dependencies.fetcher ? { fetcher: dependencies.fetcher } : {}),
    }),
    [dependencies.api, dependencies.fetcher],
  );
  const historyPort = useMemo(() => asDownloadHistoryRepo(repositories.history), [repositories.history]);
  const controller = useMemo(() => createDownloadController({
    api,
    history: historyPort,
    jobs: repositories.jobs,
    background,
    files,
    notifications: {
      complete: (job) => settingsRef.current.alerts
        ? nativeNotifications.complete(job)
        : Promise.resolve('denied'),
    },
    network,
    now: dependencies.now ?? Date.now,
    id: dependencies.id ?? createId,
  }), [api, background, dependencies.id, dependencies.now, files, historyPort, nativeNotifications, network, repositories.jobs]);

  const resolveReadinessWaiters = useCallback(() => {
    const waiters = readinessWaitersRef.current.splice(0);
    for (const waiter of waiters) waiter.resolve();
  }, []);

  const rejectReadinessWaiters = useCallback((error: Error) => {
    const waiters = readinessWaitersRef.current.splice(0);
    for (const waiter of waiters) waiter.reject(error);
  }, []);

  const failInitialization = useCallback((error: unknown) => {
    if (!mountedRef.current) return;
    const failure = error instanceof Error ? error : new Error('App data could not be loaded.');
    phaseRef.current = 'failed';
    jobProcessingAllowedRef.current = false;
    setInitializationError(failure.message);
    setOwnershipNoticeError(undefined);
    setOwnershipNoticeVisible(true);
    rejectReadinessWaiters(failure);
  }, [rejectReadinessWaiters]);

  const refreshHistory = useCallback(async () => {
    const savedEntries = await repositories.history.list();
    if (mountedRef.current) setEntries(savedEntries);
  }, [repositories.history]);

  const initializeAcceptedData = useCallback(async () => {
    if (!mountedRef.current) throw providerUnmountedError();
    phaseRef.current = 'initializing-jobs';
    jobProcessingAllowedRef.current = false;
    setInitializationError(undefined);

    try {
      // Read history before hydrating jobs so an unread database never starts persisted work.
      const savedEntries = await repositories.history.list();
      if (!mountedRef.current) throw providerUnmountedError();

      jobProcessingAllowedRef.current = true;
      await controller.reconcile();
      if (!mountedRef.current) throw providerUnmountedError();

      const cleanup = await files.cleanupTemporary(preservedTemporaryUris(controller.list()));
      if (!mountedRef.current) throw providerUnmountedError();

      setEntries(savedEntries);
      setJobs(controller.list());
      if (cleanup.failed.length) setSettingsNotice(`${cleanup.failed.length} temporary file could not be removed.`);
      phaseRef.current = 'ready';
      setOwnershipNoticeVisible(false);
      resolveReadinessWaiters();
    } catch (error) {
      failInitialization(error);
      throw error;
    }
  }, [controller, failInitialization, files, repositories.history, resolveReadinessWaiters]);

  const runInitialization = useCallback(async () => {
    if (!mountedRef.current) throw providerUnmountedError();
    phaseRef.current = 'loading-settings';
    jobProcessingAllowedRef.current = false;
    settingsLoadedRef.current = false;
    setInitializationError(undefined);
    setOwnershipNoticeError(undefined);

    try {
      const savedSettings = await repositories.settings.get();
      if (!mountedRef.current) throw providerUnmountedError();

      settingsLoadedRef.current = true;
      settingsRef.current = savedSettings;
      setSettings(savedSettings);

      if (!hasAcceptedOwnershipNotice(savedSettings.metadata)) {
        phaseRef.current = 'awaiting-acceptance';
        setOwnershipNoticeVisible(true);
        return;
      }

      await initializeAcceptedData();
    } catch (error) {
      if (!isFailedPhase(phaseRef.current)) failInitialization(error);
    }
  }, [failInitialization, initializeAcceptedData, repositories.settings]);

  const startInitialization = useCallback(() => {
    if (initializationRunRef.current) return initializationRunRef.current;
    const run = runInitialization().finally(() => {
      if (initializationRunRef.current === run) initializationRunRef.current = null;
    });
    initializationRunRef.current = run;
    return run;
  }, [runInitialization]);

  const waitUntilReady = useCallback((): Promise<void> => {
    if (phaseRef.current === 'ready') return Promise.resolve();
    if (phaseRef.current === 'unmounted' || !mountedRef.current) return Promise.reject(providerUnmountedError());
    if (phaseRef.current === 'failed') {
      return Promise.reject(new Error(initializationError ?? 'App data could not be loaded. Retry loading app data.'));
    }
    return new Promise<void>((resolve, reject) => {
      readinessWaitersRef.current.push({ resolve, reject });
    });
  }, [initializationError]);

  const enqueueSettingsMutation = useCallback((
    mutate: (latest: Settings) => Settings,
  ): Promise<Settings> => {
    if (!mountedRef.current || phaseRef.current === 'unmounted') return Promise.reject(providerUnmountedError());
    if (!settingsLoadedRef.current || phaseRef.current === 'loading-settings' || phaseRef.current === 'failed') {
      return Promise.reject(new Error(initializationError ?? 'Settings are unavailable. Retry loading app data.'));
    }

    const operation = settingsWriteQueueRef.current.then(async () => {
      if (!mountedRef.current || phaseRef.current === 'unmounted') throw providerUnmountedError();
      if (phaseRef.current === 'failed') throw new Error(initializationError ?? 'Settings are unavailable. Retry loading app data.');
      const next = mutate(settingsRef.current);
      await repositories.settings.save(settingsInput(next));
      if (!mountedRef.current) throw providerUnmountedError();
      settingsRef.current = next;
      setSettings(next);
      return next;
    });
    settingsWriteQueueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [initializationError, repositories.settings]);

  useEffect(() => {
    mountedRef.current = true;
    phaseRef.current = 'loading-settings';
    const unsubscribe = controller.subscribe((job) => {
      if (!mountedRef.current || !jobProcessingAllowedRef.current) return;
      setJobs(controller.list());
      if (job.status === 'complete') {
        refreshHistory().catch(() => {
          if (mountedRef.current) setHistoryNotice('Saved history could not be refreshed.');
        });
      }
    });
    const unsubscribeBackground = background.subscribe?.(() => {
      if (!mountedRef.current || !jobProcessingAllowedRef.current) return;
      controller.reconcile().catch(() => {
        if (mountedRef.current) setHomeTransient({ kind: 'error', message: 'Download state could not be refreshed.' });
      });
    });
    const unsubscribeNetwork = network.subscribe(({ online }) => {
      if (!mountedRef.current || phaseRef.current !== 'ready') return;
      controller.setOnline(online).catch(() => {
        if (mountedRef.current) setHomeTransient({ kind: 'error', message: 'Network state could not be applied.' });
      });
    });
    void startInitialization();
    return () => {
      mountedRef.current = false;
      phaseRef.current = 'unmounted';
      jobProcessingAllowedRef.current = false;
      acceptanceInFlightRef.current = false;
      rejectReadinessWaiters(providerUnmountedError());
      unsubscribe();
      unsubscribeBackground?.();
      unsubscribeNetwork();
    };
  }, [background, controller, network, refreshHistory, rejectReadinessWaiters, startInitialization]);

  const applyStartResult = useCallback(async (result: StartResult) => {
    if (!mountedRef.current) throw providerUnmountedError();
    if (result.kind === 'invalid_url') setHomeTransient({ kind: 'invalid' });
    else if (result.kind === 'duplicate') {
      const entry = await repositories.history.findByJobId(result.jobId);
      if (!mountedRef.current) throw providerUnmountedError();
      setHomeTransient({
        kind: 'duplicate', jobId: result.jobId,
        ...(entry?.deviceAssetRef ? { assetUri: entry.deviceAssetRef } : {}),
      });
    } else setHomeTransient(null);
    return result;
  }, [repositories.history]);

  const requireOwnershipAcceptance = waitUntilReady;

  const confirmOwnershipAcceptance = useCallback(async () => {
    if (acceptanceInFlightRef.current || phaseRef.current !== 'awaiting-acceptance'
      || hasAcceptedOwnershipNotice(settingsRef.current.metadata)) return;
    acceptanceInFlightRef.current = true;
    setOwnershipNoticeAccepting(true);
    setOwnershipNoticeError(undefined);

    try {
      await enqueueSettingsMutation((latest) => ({
        ...latest,
        metadata: acceptOwnershipNotice(latest.metadata),
      }));
      await initializeAcceptedData();
    } catch (error) {
      if (mountedRef.current && !isFailedPhase(phaseRef.current)) {
        setOwnershipNoticeError(errorMessage(error, 'Acceptance could not be saved. Please try again.'));
      }
    } finally {
      acceptanceInFlightRef.current = false;
      if (mountedRef.current) setOwnershipNoticeAccepting(false);
    }
  }, [enqueueSettingsMutation, initializeAcceptedData]);

  const retryInitialization = useCallback(async () => {
    if (phaseRef.current !== 'failed' || initializationRetrying) return;
    setInitializationRetrying(true);
    try {
      await startInitialization();
    } finally {
      if (mountedRef.current) setInitializationRetrying(false);
    }
  }, [initializationRetrying, startInitialization]);

  const pasteAndDownload = useCallback(async (): Promise<PasteAndDownloadResult> => {
    try {
      await requireOwnershipAcceptance();
      if (!mountedRef.current) throw providerUnmountedError();
      const text = dependencies.clipboard
        ? await dependencies.clipboard.getStringAsync()
        : await (require('expo-clipboard') as typeof import('expo-clipboard')).getStringAsync();
      if (!mountedRef.current) throw providerUnmountedError();
      lastClipboardText.current = text;
      return await applyStartResult(await controller.startFromText(text, settingsRef.current.quality));
    } catch (error) {
      if (mountedRef.current) setHomeTransient({ kind: 'error', message: errorMessage(error, 'Clipboard download failed.') });
      return { kind: 'action_failed' };
    }
  }, [applyStartResult, controller, dependencies.clipboard, requireOwnershipAcceptance]);

  const startSharedUrl = useCallback(async (url: string): Promise<StartResult> => {
    await requireOwnershipAcceptance();
    if (!mountedRef.current) throw providerUnmountedError();
    return applyStartResult(await controller.startFromText(url, settingsRef.current.quality));
  }, [applyStartResult, controller, requireOwnershipAcceptance]);

  const saveSharedFiles = useCallback(async (sharedFiles: readonly DirectMediaInput[]): Promise<StartResult> => {
    await requireOwnershipAcceptance();
    if (!mountedRef.current) throw providerUnmountedError();
    return applyStartResult(await controller.startFromDirectFiles(sharedFiles));
  }, [applyStartResult, controller, requireOwnershipAcceptance]);

  const discardIncomingShare = useCallback(async (uris: readonly string[]): Promise<void> => {
    await files.cleanupIncomingStaging?.(uris);
  }, [files]);

  const downloadAgain = useCallback(async () => {
    const text = lastClipboardText.current;
    if (!text) return undefined;
    try {
      await requireOwnershipAcceptance();
      return await applyStartResult(await controller.startFromText(text, settingsRef.current.quality, { allowDuplicate: true }));
    } catch (error) {
      if (mountedRef.current) setHomeTransient({ kind: 'error', message: errorMessage(error, 'The download could not be restarted.') });
      return undefined;
    }
  }, [applyStartResult, controller, requireOwnershipAcceptance]);

  const chooseMedia = useCallback(async (jobId: string, selection: DownloadSelection) => {
    try {
      await requireOwnershipAcceptance();
      return await controller.choose(jobId, selection);
    } catch (error) {
      if (mountedRef.current) setHomeTransient({ kind: 'error', message: errorMessage(error, 'Media selection could not be saved.') });
      return undefined;
    }
  }, [controller, requireOwnershipAcceptance]);
  const cancel = useCallback(async (jobId: string) => {
    try {
      await requireOwnershipAcceptance();
      await controller.cancel(jobId);
    } catch (error) {
      if (mountedRef.current) setHomeTransient({ kind: 'error', message: errorMessage(error, 'The download could not be cancelled.') });
    }
  }, [controller, requireOwnershipAcceptance]);
  const retry = useCallback(async (jobId: string) => {
    try {
      await requireOwnershipAcceptance();
      return await controller.retry(jobId);
    } catch (error) {
      if (mountedRef.current) setHomeTransient({ kind: 'error', message: errorMessage(error, 'The download could not be retried.') });
      return undefined;
    }
  }, [controller, requireOwnershipAcceptance]);

  const deleteHistory = useCallback(async (ids: string[], choice: HistoryDeleteChoice): Promise<DeleteHistoryOutcome> => {
    const outcome: DeleteHistoryOutcome = { deletedIds: [], failures: [] };
    let unexpectedNotice: string | undefined;
    try {
      await requireOwnershipAcceptance();
    } catch (error) {
      const message = errorMessage(error, 'History is unavailable until app data is loaded.');
      if (mountedRef.current) setHistoryNotice(message);
      return {
        deletedIds: [],
        failures: ids.map((id) => ({ id, kind: 'history_error' as const, deviceDeleted: false })),
      };
    }
    for (const id of ids) {
      try {
        const entry = entries.find((candidate) => candidate.id === id)
          ?? await repositories.history.findByJobId(id);
        if (!entry) {
          outcome.failures.push({ id, kind: 'history_error', deviceDeleted: false });
          continue;
        }
        const result = await deleteDownload(
          { id: entry.id, deviceAssetRef: entry.deviceAssetRef },
          choice,
          {
            async deleteAsset(assetUri) {
              await files.deleteAsset(assetUri);
              return true;
            },
            removeRecord: (recordId) => repositories.history.remove(recordId),
          },
        );
        if (result.kind === 'deleted') outcome.deletedIds.push(id);
        else outcome.failures.push({ id, ...result });
      } catch (error) {
        outcome.failures.push({ id, kind: 'history_error', deviceDeleted: false });
        unexpectedNotice = error instanceof Error ? error.message : 'History could not be updated.';
      }
    }
    if (mountedRef.current) {
      if (outcome.deletedIds.length) setEntries((current) => current.filter(({ id }) => !outcome.deletedIds.includes(id)));
      setHistoryNotice(unexpectedNotice ?? (outcome.failures.length ? `${outcome.failures.length} item could not be removed.` : undefined));
    }
    return outcome;
  }, [entries, files, repositories.history, requireOwnershipAcceptance]);

  const updateSettings = useCallback(async (
    patch: Partial<Pick<Settings, 'quality' | 'smartAutoSave' | 'alerts' | 'allowCellular' | 'themeMode'>>,
  ) => {
    try {
      await enqueueSettingsMutation((latest) => ({
        ...latest,
        ...patch,
        metadata: { ...latest.metadata },
      }));
      if (mountedRef.current) setSettingsNotice(undefined);
    } catch (error) {
      if (mountedRef.current) setSettingsNotice(errorMessage(error, 'Settings could not be saved.'));
    }
  }, [enqueueSettingsMutation]);

  const cleanupTemporary = useCallback(async () => {
    try {
      await requireOwnershipAcceptance();
      const preserve = preservedTemporaryUris(controller.list());
      const outcome = await files.cleanupTemporary(preserve);
      if (mountedRef.current) setSettingsNotice(outcome.failed.length ? `${outcome.failed.length} temporary file could not be removed.` : 'Temporary files were cleaned.');
    } catch (error) {
      if (mountedRef.current) setSettingsNotice(errorMessage(error, 'Temporary files could not be cleaned.'));
    }
  }, [controller, files, requireOwnershipAcceptance]);

  const requestSaveLocationAccess = useCallback(async () => {
    try {
      const permission = await files.requestMediaPermission();
      if (mountedRef.current) setSettingsNotice(permission === 'granted' ? 'Media-library access is enabled.' : 'Media permission was denied.');
    } catch (error) {
      if (mountedRef.current) setSettingsNotice(errorMessage(error, 'Media permission could not be checked.'));
    }
  }, [files]);

  const value = useMemo<DownloadContextValue>(() => ({
    home: homeModel(jobs, homeTransient),
    history: { items: entries.map(historyModel), ...(historyNotice ? { notice: historyNotice } : {}) },
    settings: settingsModel(settings, settingsNotice),
    pasteAndDownload,
    startSharedUrl,
    saveSharedFiles,
    discardIncomingShare,
    downloadAgain,
    chooseMedia,
    cancel,
    retry,
    deleteHistory,
    updateSettings,
    cleanupTemporary,
    requestSaveLocationAccess,
    share: async (assetUri) => {
      try { await files.shareAsset(assetUri); } catch (error) {
        if (mountedRef.current) setHistoryNotice(error instanceof Error ? error.message : 'The saved file could not be shared.');
      }
    },
    open: async (assetUri) => {
      try { await files.openAsset(assetUri); } catch (error) {
        if (mountedRef.current) setHistoryNotice(error instanceof Error ? error.message : 'The saved file could not be opened.');
      }
    },
  }), [cancel, chooseMedia, cleanupTemporary, deleteHistory, discardIncomingShare, downloadAgain, entries, files, historyNotice, homeTransient, jobs, pasteAndDownload, requestSaveLocationAccess, retry, saveSharedFiles, settings, settingsNotice, startSharedUrl, updateSettings]);

  return (
    <DownloadContext.Provider value={value}>
      {children}
      <AppThemeProvider mode={settings.themeMode}>
        <OwnershipNotice
          accepting={ownershipNoticeAccepting}
          blockingError={initializationError}
          error={ownershipNoticeError}
          onAccept={confirmOwnershipAcceptance}
          onRetry={retryInitialization}
          retrying={initializationRetrying}
          visible={ownershipNoticeVisible}
        />
      </AppThemeProvider>
    </DownloadContext.Provider>
  );
}

export function useDownloads(): DownloadContextValue {
  const value = useContext(DownloadContext);
  if (!value) throw new Error('useDownloads must be used within DownloadProvider.');
  return value;
}
