import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Button, Text } from 'react-native';

import type { AppRepositories } from '../history/db';
import type { DownloadPorts } from './ports';
import type { DownloadJob } from './types';

const mockRepositories = {
  history: {
    findByIdentity: jest.fn().mockResolvedValue(null),
    findByJobId: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  jobs: {
    save: jest.fn().mockResolvedValue(undefined),
    listActive: jest.fn().mockResolvedValue([]),
  },
  settings: {
    get: jest.fn().mockResolvedValue({
      quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
      themeMode: 'system', metadataVersion: 1, metadata: { ownershipNoticeAccepted: true },
    }),
    save: jest.fn().mockResolvedValue(undefined),
  },
} as unknown as AppRepositories;

jest.mock('../history/db', () => ({
  useRepositories: () => mockRepositories,
}));

const clipboard = { getStringAsync: jest.fn().mockResolvedValue('https://instagram.com/reel/live') };
const files: DownloadPorts['files'] = {
  temporaryUri: jest.fn().mockReturnValue('file:///cache/live.mp4'),
  importIncoming: jest.fn().mockResolvedValue({
    temporaryUri: 'file:///cache/live.mp4', sizeBytes: 128, fingerprint: 'local:live:128',
  }),
  export: jest.fn().mockResolvedValue({ assetUri: 'ph://live' }),
  removeTemporary: jest.fn().mockResolvedValue(undefined),
  cleanupTemporary: jest.fn().mockResolvedValue({ removed: [], failed: [] }),
  cleanupIncomingStaging: jest.fn().mockResolvedValue(undefined),
  requestMediaPermission: jest.fn().mockResolvedValue('granted'),
  deleteAsset: jest.fn().mockResolvedValue(undefined),
  shareAsset: jest.fn().mockResolvedValue(undefined),
  openAsset: jest.fn().mockResolvedValue(undefined),
};
let backgroundListener: (() => void) | undefined;
const background: DownloadPorts['background'] = {
  enqueue: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
  subscribe: jest.fn().mockImplementation((listener: () => void) => {
    backgroundListener = listener;
    return () => undefined;
  }),
};
const network: NonNullable<DownloadPorts['network']> = {
  getCurrent: jest.fn().mockResolvedValue({ online: true }),
  subscribe: jest.fn().mockReturnValue(() => undefined),
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function loadContext() {
  return require('./context') as typeof import('./context');
}

async function runIntent<T>(intent: () => Promise<T>): Promise<T> {
  let result!: T;
  await act(async () => { result = await intent(); });
  return result;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  clipboard.getStringAsync.mockResolvedValue('https://instagram.com/reel/live');
  (background.enqueue as jest.Mock).mockResolvedValue(undefined);
  (background.cancel as jest.Mock).mockResolvedValue(undefined);
  (background.list as jest.Mock).mockResolvedValue([]);
  backgroundListener = undefined;
  (background.subscribe as jest.Mock).mockImplementation((listener: () => void) => {
    backgroundListener = listener;
    return () => undefined;
  });
  (network.getCurrent as jest.Mock).mockResolvedValue({ online: true });
  (network.subscribe as jest.Mock).mockReturnValue(() => undefined);
  (files.cleanupTemporary as jest.Mock).mockResolvedValue({ removed: [], failed: [] });
  (files.cleanupIncomingStaging as jest.Mock).mockResolvedValue(undefined);
  (files.importIncoming as jest.Mock).mockResolvedValue({
    temporaryUri: 'file:///cache/live.mp4', sizeBytes: 128, fingerprint: 'local:live:128',
  });
  (files.requestMediaPermission as jest.Mock).mockResolvedValue('granted');
  (files.deleteAsset as jest.Mock).mockResolvedValue(undefined);
  (files.shareAsset as jest.Mock).mockResolvedValue(undefined);
  (files.openAsset as jest.Mock).mockResolvedValue(undefined);
  process.env.EXPO_PUBLIC_API_URL = 'https://app.imediasave.test/';
  mockRepositories.history.findByIdentity = jest.fn().mockResolvedValue(null);
  mockRepositories.history.findByJobId = jest.fn().mockResolvedValue(null);
  mockRepositories.history.list = jest.fn().mockResolvedValue([]);
  mockRepositories.history.save = jest.fn().mockResolvedValue(undefined);
  mockRepositories.history.remove = jest.fn().mockResolvedValue(undefined);
  mockRepositories.jobs.save = jest.fn().mockResolvedValue(undefined);
  mockRepositories.jobs.listActive = jest.fn().mockResolvedValue([]);
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: { ownershipNoticeAccepted: true },
  });
  mockRepositories.settings.save = jest.fn().mockResolvedValue(undefined);
});

test('loads settings first and waits for persisted ownership acceptance before resuming jobs', async () => {
  const order: string[] = [];
  mockRepositories.settings.get = jest.fn().mockImplementation(async () => {
    order.push('settings');
    return {
      quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
      themeMode: 'system', metadataVersion: 1, metadata: {},
    };
  });
  mockRepositories.history.list = jest.fn().mockImplementation(async () => {
    order.push('history');
    return [];
  });
  mockRepositories.jobs.listActive = jest.fn().mockImplementation(async () => {
    order.push('jobs');
    return [{ id: 'persisted-job', sourceUrl: 'https://example.com/persisted', status: 'queued' }];
  });
  const api = {
    preview: jest.fn().mockImplementation(async () => {
      order.push('preview');
      return { kind: 'preview', platform: 'example', url: 'https://example.com/persisted' } as const;
    }),
    download: jest.fn().mockResolvedValue({
      kind: 'direct', platform: 'example', downloadUrl: 'https://cdn.test/persisted.mp4',
      filename: 'persisted.mp4', mediaType: 'video',
    } as const),
  };
  const { DownloadProvider } = loadContext();

  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Text>consumer</Text>
    </DownloadProvider>,
  );

  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();
  expect(order).toEqual(['settings']);
  expect(mockRepositories.jobs.listActive).not.toHaveBeenCalled();
  expect(background.list).not.toHaveBeenCalled();
  expect(api.preview).not.toHaveBeenCalled();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));

  await waitFor(() => expect(api.preview).toHaveBeenCalledWith('https://example.com/persisted'));
  expect(order.slice(0, 3)).toEqual(['settings', 'history', 'jobs']);
  expect(background.enqueue).toHaveBeenCalledTimes(1);
}, 10_000);

test('reconciles a native completion that arrives while accepted jobs are initializing', async () => {
  const cleanup = deferred<{ removed: string[]; failed: Array<{ uri: string; message: string }> }>();
  const persisted: Extract<DownloadJob, { status: 'downloading' }> = {
    id: 'initializing-job', sourceUrl: 'https://example.com/initializing', status: 'downloading',
    selection: {
      itemId: 'item-1', quality: 'balanced',
      variant: { id: 'variant-1', mediaType: 'video', reliable: true },
    },
    transfer: {
      downloadUrl: 'https://cdn.test/initializing.mp4', filename: 'initializing.mp4',
      mediaType: 'video', mimeType: 'video/mp4',
    },
    temporaryUri: 'file:///cache/initializing.mp4',
  };
  mockRepositories.jobs.listActive = jest.fn().mockResolvedValue([persisted]);
  (background.list as jest.Mock)
    .mockResolvedValueOnce([{ id: persisted.id, status: 'downloading' }])
    .mockResolvedValueOnce([{
      id: persisted.id, status: 'complete', fileUri: persisted.temporaryUri, sizeBytes: 4096,
    }]);
  (files.cleanupTemporary as jest.Mock).mockReturnValueOnce(cleanup.promise);
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>{context.home.statusText}</Text>; }

  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(files.cleanupTemporary).toHaveBeenCalledTimes(1));
  expect(background.list).toHaveBeenCalledTimes(1);

  await act(async () => {
    backgroundListener?.();
    await Promise.resolve();
  });
  await waitFor(() => expect(background.list).toHaveBeenCalledTimes(2));
  cleanup.resolve({ removed: [], failed: [] });

  await waitFor(() => expect(context.home.phase).toBe('complete'));
  expect(mockRepositories.history.save).toHaveBeenCalledWith(expect.objectContaining({ id: persisted.id }));
}, 10_000);

test('blocks initialization-dependent work after a settings read failure and retries without writing defaults', async () => {
  mockRepositories.settings.get = jest.fn()
    .mockRejectedValueOnce(new Error('settings database unreadable'))
    .mockResolvedValueOnce({
      quality: 'original', smartAutoSave: false, alerts: true, allowCellular: false,
      themeMode: 'dark', metadataVersion: 1, metadata: { ownershipNoticeAccepted: true },
    });
  const api = {
    preview: jest.fn(),
    download: jest.fn(),
  };
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>{context.settings.quality}</Text>; }

  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );

  expect(await screen.findByText(/settings database unreadable/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retry loading app data' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Accept responsible use notice' })).toBeNull();

  await act(async () => { await context.updateSettings({ alerts: false }); });
  expect(mockRepositories.settings.save).not.toHaveBeenCalled();
  expect(mockRepositories.jobs.listActive).not.toHaveBeenCalled();
  expect(clipboard.getStringAsync).not.toHaveBeenCalled();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Retry loading app data' }));

  await waitFor(() => expect(mockRepositories.jobs.listActive).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Retry loading app data' })).toBeNull();
  expect(context.settings.quality).toBe('Original');
  await act(async () => { await context.updateSettings({ alerts: false }); });
  expect(mockRepositories.settings.save).toHaveBeenCalledWith(expect.objectContaining({
    quality: 'original', allowCellular: false, alerts: false,
  }));
}, 10_000);

test('keeps work blocked after a failed acceptance write and allows an explicit acceptance retry', async () => {
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: {},
  });
  mockRepositories.settings.save = jest.fn()
    .mockRejectedValueOnce(new Error('acceptance could not be stored'))
    .mockResolvedValueOnce(undefined);
  const api = {
    preview: jest.fn().mockResolvedValue({
      kind: 'preview', platform: 'example', url: 'https://example.com/shared',
    }),
    download: jest.fn().mockResolvedValue({
      kind: 'direct', platform: 'example', downloadUrl: 'https://cdn.test/shared.mp4',
      filename: 'shared.mp4', mediaType: 'video',
    }),
  } as const;
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>consumer</Text>; }

  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();

  const start = context.startSharedUrl('https://example.com/shared');
  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));

  expect(await screen.findByText('acceptance could not be stored')).toBeTruthy();
  expect(mockRepositories.jobs.listActive).not.toHaveBeenCalled();
  expect(api.preview).not.toHaveBeenCalled();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));
  await act(async () => { await start; });

  expect(mockRepositories.settings.save).toHaveBeenCalledTimes(2);
  expect(mockRepositories.jobs.listActive).toHaveBeenCalledTimes(1);
  expect(api.preview).toHaveBeenCalledWith('https://example.com/shared');
}, 10_000);

test('serializes a concurrent settings update and acceptance without losing either change', async () => {
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: {},
  });
  const firstWrite = deferred<void>();
  mockRepositories.settings.save = jest.fn()
    .mockImplementationOnce(() => firstWrite.promise)
    .mockResolvedValue(undefined);
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>consumer</Text>; }

  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();

  const settingsWrite = context.updateSettings({ alerts: false });
  await waitFor(() => expect(mockRepositories.settings.save).toHaveBeenCalledTimes(1));

  const acceptance = fireEvent.press(screen.getByRole('button', { name: 'Accept responsible use notice' }));
  firstWrite.resolve();
  await Promise.all([settingsWrite, acceptance]);
  await waitFor(() => expect(mockRepositories.settings.save).toHaveBeenCalledTimes(2));
  expect(mockRepositories.settings.save).toHaveBeenNthCalledWith(1, expect.objectContaining({
    alerts: false, metadata: {},
  }));
  expect(mockRepositories.settings.save).toHaveBeenNthCalledWith(2, expect.objectContaining({
    alerts: false, metadata: { ownershipNoticeAccepted: true },
  }));
  await waitFor(() => expect(screen.queryByRole('alert', { name: 'Responsible use notice' })).toBeNull());
}, 10_000);

test('rejects pending ownership waiters on unmount without continuing shared URL work', async () => {
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: {},
  });
  const api = { preview: jest.fn(), download: jest.fn() };
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>consumer</Text>; }
  const view = await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();

  let settled: unknown;
  const start = context.startSharedUrl('https://example.com/shared')
    .then((value) => { settled = value; })
    .catch((error: unknown) => { settled = error; });
  view.unmount();

  await waitFor(() => expect(settled).toBeInstanceOf(Error));
  expect((settled as Error).message).toMatch(/provider unmounted/i);
  expect(api.preview).not.toHaveBeenCalled();
  expect(mockRepositories.settings.save).not.toHaveBeenCalled();
  await start;
}, 10_000);

test('does not start clipboard processing when the provider unmounts during the clipboard read', async () => {
  const clipboardRead = deferred<string>();
  const delayedClipboard = { getStringAsync: jest.fn(() => clipboardRead.promise) };
  const api = { preview: jest.fn(), download: jest.fn() };
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>consumer</Text>; }
  const view = await render(
    <DownloadProvider dependencies={{ api, background, clipboard: delayedClipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(mockRepositories.jobs.listActive).toHaveBeenCalledTimes(1));

  const start = context.pasteAndDownload();
  await waitFor(() => expect(delayedClipboard.getStringAsync).toHaveBeenCalledTimes(1));
  await view.unmount();
  clipboardRead.resolve('https://example.com/after-unmount');

  await expect(start).resolves.toEqual({ kind: 'action_failed' });
  expect(api.preview).not.toHaveBeenCalled();
}, 10_000);

test('does not publish duplicate history state when unmounted during its lookup', async () => {
  const duplicateLookup = deferred<null>();
  mockRepositories.history.findByIdentity = jest.fn().mockResolvedValue({
    id: 'existing-job',
    sourceUrl: 'https://example.com/duplicate',
  });
  mockRepositories.history.findByJobId = jest.fn(() => duplicateLookup.promise);
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>consumer</Text>; }
  const view = await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(mockRepositories.jobs.listActive).toHaveBeenCalledTimes(1));

  let settled: unknown;
  const start = context.startSharedUrl('https://example.com/duplicate')
    .then((value) => { settled = value; })
    .catch((error: unknown) => { settled = error; });
  await waitFor(() => expect(mockRepositories.history.findByJobId).toHaveBeenCalledWith('existing-job'));
  await view.unmount();
  duplicateLookup.resolve(null);
  await start;

  expect(settled).toBeInstanceOf(Error);
  expect((settled as Error).message).toMatch(/provider unmounted/i);
}, 10_000);

test('gates a first shared URL until acceptance is persisted and initialization completes', async () => {
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: {},
  });
  const api = {
    preview: jest.fn().mockResolvedValue({
      kind: 'preview', platform: 'example', url: 'https://example.com/shared',
    }),
    download: jest.fn().mockResolvedValue({
      kind: 'direct', platform: 'example', downloadUrl: 'https://cdn.test/shared.mp4',
      filename: 'shared.mp4', mediaType: 'video',
    }),
  } as const;
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>consumer</Text>; }

  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();
  const start = context.startSharedUrl('https://example.com/shared');

  expect(api.preview).not.toHaveBeenCalled();
  expect(mockRepositories.jobs.listActive).not.toHaveBeenCalled();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));
  await act(async () => { await start; });

  expect(mockRepositories.settings.save).toHaveBeenCalledWith(expect.objectContaining({
    metadata: { ownershipNoticeAccepted: true },
  }));
  expect(mockRepositories.jobs.listActive).toHaveBeenCalledTimes(1);
  expect(api.preview).toHaveBeenCalledWith('https://example.com/shared');
}, 10_000);

test('persists the first-download notice before reading the clipboard or starting work, then does not repeat it', async () => {
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: {},
  });
  const api = {
    preview: jest.fn().mockResolvedValue({
      kind: 'preview', platform: 'instagram', url: 'https://instagram.com/reel/live', title: 'Live reel',
    }),
    download: jest.fn().mockResolvedValue({
      kind: 'direct', platform: 'instagram', downloadUrl: 'https://cdn.test/live.mp4', filename: 'live.mp4', mediaType: 'video',
    }),
  } as const;
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;

  function Consumer() {
    context = useDownloads();
    return <Button title="Paste" onPress={() => void context.pasteAndDownload()} />;
  }

  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(mockRepositories.settings.get).toHaveBeenCalledTimes(1));

  await userEvent.setup().press(screen.getByRole('button', { name: 'Paste' }));
  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();
  expect(clipboard.getStringAsync).not.toHaveBeenCalled();
  expect(api.preview).not.toHaveBeenCalled();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));
  await waitFor(() => expect(mockRepositories.settings.save).toHaveBeenCalledWith(expect.objectContaining({
    metadata: { ownershipNoticeAccepted: true },
  })));
  await waitFor(() => expect(clipboard.getStringAsync).toHaveBeenCalledTimes(1));
  expect(api.preview).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert', { name: 'Responsible use notice' })).toBeNull();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Paste' }));
  await waitFor(() => expect(clipboard.getStringAsync).toHaveBeenCalledTimes(2));
  expect(mockRepositories.settings.save).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert', { name: 'Responsible use notice' })).toBeNull();
}, 10_000);

test('gates a first shared file before local import and continues it after acceptance', async () => {
  mockRepositories.settings.get = jest.fn().mockResolvedValue({
    quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true,
    themeMode: 'system', metadataVersion: 1, metadata: {},
  });
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>ready</Text>; }

  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(mockRepositories.settings.get).toHaveBeenCalledTimes(1));

  let start!: ReturnType<typeof context.saveSharedFiles>;
  await act(async () => {
    start = context.saveSharedFiles([{
      sourceUri: 'content://share/photo', filename: 'photo.jpg', mediaType: 'image',
      mimeType: 'image/jpeg', sizeBytes: 128,
    }]);
    await Promise.resolve();
  });
  expect(await screen.findByRole('alert', { name: 'Responsible use notice' })).toBeTruthy();
  expect(files.importIncoming).not.toHaveBeenCalled();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));
  await act(async () => { await start; });
  expect(files.importIncoming).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert', { name: 'Responsible use notice' })).toBeNull();
}, 10_000);

test('reads Clipboard.getStringAsync only inside the intentional pasteAndDownload action', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse({
      success: true, platform: 'instagram', url: 'https://instagram.com/reel/live', title: 'Live reel', type: 'video',
    }))
    .mockResolvedValueOnce(jsonResponse({
      success: true, platform: 'instagram', downloadUrl: 'https://cdn.test/live.mp4', filename: 'live.mp4', type: 'video',
    }));
  const { DownloadProvider, useDownloads } = loadContext();

  function Consumer() {
    const downloads = useDownloads();
    return <Button title="Paste" onPress={() => void downloads.pasteAndDownload()} />;
  }

  await render(
    <DownloadProvider dependencies={{ background, clipboard, fetcher, files, network, notifications: { complete: jest.fn().mockResolvedValue('sent') } }}>
      <Consumer />
    </DownloadProvider>,
  );

  await waitFor(() => expect(mockRepositories.jobs.listActive).toHaveBeenCalledTimes(1));
  expect(clipboard.getStringAsync).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Paste' }));

  await waitFor(() => expect(background.enqueue).toHaveBeenCalledTimes(1));
  expect(clipboard.getStringAsync).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenNthCalledWith(
    1,
    'https://app.imediasave.test/api/preview',
    expect.objectContaining({ method: 'POST' }),
  );
}, 10_000);

test('exposes shared URL and direct-file intents without route-owned infrastructure', async () => {
  const api = {
    preview: jest.fn().mockResolvedValue({
      kind: 'preview', platform: 'instagram', url: 'https://instagram.com/reel/shared', title: 'Shared reel',
    }),
    download: jest.fn().mockResolvedValue({
      kind: 'direct', platform: 'instagram', downloadUrl: 'https://cdn.test/shared.mp4', filename: 'shared.mp4', mediaType: 'video',
    }),
  } as const;
  (files.temporaryUri as jest.Mock).mockImplementation(({ filename }: { filename: string }) => `file:///cache/${filename}`);
  (files.importIncoming as jest.Mock)
    .mockResolvedValueOnce({ temporaryUri: 'file:///cache/one.jpg', sizeBytes: 10, fingerprint: 'local:one:10' })
    .mockResolvedValueOnce({ temporaryUri: 'file:///cache/two.mp4', sizeBytes: 20, fingerprint: 'local:two:20' });
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>{context.home.phase}</Text>; }

  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(mockRepositories.jobs.listActive).toHaveBeenCalled());

  await runIntent(() => context.startSharedUrl('https://instagram.com/reel/shared'));
  expect(api.preview).toHaveBeenCalledWith('https://instagram.com/reel/shared');
  expect(clipboard.getStringAsync).not.toHaveBeenCalled();

  (api.preview as jest.Mock).mockClear();
  (api.download as jest.Mock).mockClear();
  const result = await runIntent(() => context.saveSharedFiles([
    { sourceUri: 'content://share/one', filename: 'one.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 10 },
    { sourceUri: 'content://share/two', filename: 'two.mp4', mediaType: 'video', mimeType: 'video/mp4', sizeBytes: 20 },
  ]));

  expect(result).toMatchObject({ kind: 'selection_required' });
  expect(context.home.phase).toBe('selection_required');
  expect(context.home.mediaChoices).toHaveLength(2);
  expect(api.preview).not.toHaveBeenCalled();
  expect(api.download).not.toHaveBeenCalled();

  await runIntent(() => context.discardIncomingShare(['file:///group/rejected.html']));
  expect(files.cleanupIncomingStaging).toHaveBeenCalledWith(['file:///group/rejected.html']);
});

test('startup cleanup preserves every direct-share selection temporary URI', async () => {
  const directTransfer = (uri: string, filename: string) => ({
    downloadUrl: uri, filename, mediaType: 'video' as const, mimeType: 'video/mp4',
    sourceKind: 'device-share' as const, mediaIdentity: `local:${filename}`,
  });
  mockRepositories.jobs.listActive = jest.fn().mockResolvedValue([{
    id: 'job-selection', sourceUrl: 'shared-media://job-selection', status: 'selection_required',
    preview: { items: [
      { id: 'one', mediaType: 'video', variants: [{ id: 'one-v', mediaType: 'video', reliable: true, transfer: directTransfer('file:///cache/one.mp4', 'one.mp4') }] },
      { id: 'two', mediaType: 'video', variants: [{ id: 'two-v', mediaType: 'video', reliable: true, transfer: directTransfer('file:///cache/two.mp4', 'two.mp4') }] },
    ] },
  }]);
  const { DownloadProvider } = loadContext();
  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Text>ready</Text>
    </DownloadProvider>,
  );

  await waitFor(() => expect(files.cleanupTemporary).toHaveBeenCalledWith(expect.arrayContaining([
    'file:///cache/one.mp4', 'file:///cache/two.mp4',
  ])));
});

test('exposes serializable live models and repository-backed settings, deletion, share, and open intents', async () => {
  mockRepositories.history.list = jest.fn().mockResolvedValue([{
    id: 'history-1', sourceUrl: 'https://instagram.com/reel/one', mediaIdentity: 'instagram:one',
    platform: 'instagram', thumbnailUrl: null, filename: 'one.mp4', mimeType: 'video/mp4',
    sizeBytes: 2048, status: 'saved', createdAt: 100, completedAt: 200, quality: 'balanced',
    deviceAssetRef: 'ph://one', metadataVersion: 1, metadata: { mediaType: 'video' },
  }]);
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;

  function Consumer() {
    context = useDownloads();
    return <Text>{`${context.history.items.length}:${context.settings.quality}`}</Text>;
  }

  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn().mockResolvedValue('sent') } }}>
      <Consumer />
    </DownloadProvider>,
  );

  await waitFor(() => expect(screen.getByText('1:Balanced')).toBeTruthy());
  expect(() => JSON.stringify({ home: context.home, history: context.history, settings: context.settings })).not.toThrow();

  await act(async () => {
    await context.updateSettings({ alerts: false });
    await context.share('ph://one');
    await context.open('ph://one');
    await context.deleteHistory(['history-1'], 'history-only');
  });
  expect(mockRepositories.settings.save).toHaveBeenCalledWith(expect.objectContaining({ alerts: false }));
  expect(files.shareAsset).toHaveBeenCalledWith('ph://one');
  expect(files.openAsset).toHaveBeenCalledWith('ph://one');
  expect(files.deleteAsset).not.toHaveBeenCalled();
  expect(mockRepositories.history.remove).toHaveBeenCalledWith('history-1');

  mockRepositories.history.findByJobId = jest.fn().mockResolvedValue({
    id: 'history-1', sourceUrl: 'https://instagram.com/reel/one', mediaIdentity: 'instagram:one',
    platform: 'instagram', thumbnailUrl: null, filename: 'one.mp4', mimeType: 'video/mp4', sizeBytes: 2048,
    status: 'saved', createdAt: 100, completedAt: 200, quality: 'balanced', deviceAssetRef: 'ph://one',
    metadataVersion: 1, metadata: { mediaType: 'video' },
  });
  await act(async () => {
    await context.deleteHistory(['history-1'], 'device-and-history');
  });
  expect(files.deleteAsset).toHaveBeenCalledWith('ph://one');
});

test('turns invalid clipboard and canonical duplicate results into visible actions without rereading Clipboard', async () => {
  clipboard.getStringAsync
    .mockResolvedValueOnce('not a link')
    .mockResolvedValueOnce('https://youtu.be/video-one?si=tracking');
  const existing = {
    id: 'history-youtube', sourceUrl: 'https://youtube.com/watch?v=video-one', mediaIdentity: 'youtube:video-one',
    platform: 'youtube', thumbnailUrl: null, filename: 'one.mp4', mimeType: 'video/mp4', sizeBytes: 1024,
    status: 'saved', createdAt: 100, completedAt: 200, quality: 'balanced', deviceAssetRef: 'ph://one',
    metadataVersion: 1, metadata: { mediaType: 'video' },
  };
  mockRepositories.history.findByIdentity = jest.fn().mockImplementation(async (identity: string) => (
    identity === 'youtube:video-one' ? existing : null
  ));
  mockRepositories.history.findByJobId = jest.fn().mockResolvedValue(existing);
  const api = {
    preview: jest.fn().mockResolvedValue({ kind: 'preview', platform: 'youtube', url: existing.sourceUrl }),
    download: jest.fn().mockResolvedValue({
      kind: 'direct', platform: 'youtube', downloadUrl: 'https://cdn/one.mp4', filename: 'one.mp4', mediaType: 'video',
    }),
  } as const;
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;

  function Consumer() {
    context = useDownloads();
    return <Text>{`${context.home.phase}:${context.home.primaryAction.label}:${context.home.secondaryAction?.label ?? ''}`}</Text>;
  }
  await render(
    <DownloadProvider dependencies={{ api, background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );

  await act(async () => { await context.pasteAndDownload(); });
  expect(screen.getByText('failed:Paste another link:')).toBeTruthy();
  await act(async () => { await context.pasteAndDownload(); });
  expect(screen.getByText('duplicate:View:Download again')).toBeTruthy();
  await act(async () => { await context.downloadAgain(); });
  expect(clipboard.getStringAsync).toHaveBeenCalledTimes(2);
  expect(api.preview).toHaveBeenCalledTimes(1);
});

test('returns per-item deletion outcomes, retains failures, and exposes cleanup and media permission notices', async () => {
  const items = ['one', 'two'].map((id) => ({
    id, sourceUrl: `https://example.com/${id}`, mediaIdentity: `url:${id}`, platform: 'example', thumbnailUrl: null,
    filename: `${id}.mp4`, mimeType: 'video/mp4', sizeBytes: 10, status: 'saved', createdAt: 1, completedAt: 2,
    quality: 'balanced', deviceAssetRef: `ph://${id}`, metadataVersion: 1, metadata: { mediaType: 'video' },
  }));
  mockRepositories.history.list = jest.fn().mockResolvedValue(items);
  mockRepositories.history.remove = jest.fn().mockImplementation(async (id: string) => {
    if (id === 'two') throw new Error('sqlite unavailable');
  });
  (files.requestMediaPermission as jest.Mock).mockResolvedValueOnce('denied');
  (files.cleanupTemporary as jest.Mock)
    .mockResolvedValueOnce({ removed: [], failed: [] })
    .mockResolvedValueOnce({
    removed: ['file:///cache/one'], failed: [{ uri: 'file:///cache/two', message: 'busy' }],
  });
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() { context = useDownloads(); return <Text>{context.history.notice ?? context.settings.notice ?? ''}</Text>; }
  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(context.history.items).toHaveLength(2));

  let outcome!: Awaited<ReturnType<typeof context.deleteHistory>>;
  await act(async () => { outcome = await context.deleteHistory(['one', 'two'], 'history-only'); });
  expect(outcome).toEqual({ deletedIds: ['one'], failures: [{ id: 'two', kind: 'history_error', deviceDeleted: false }] });
  expect(context.history.notice).toContain('1 item could not be removed');
  await act(async () => { await context.cleanupTemporary(); });
  expect(context.settings.notice).toContain('1 temporary file could not be removed');
  await act(async () => { await context.requestSaveLocationAccess(); });
  expect(context.settings.notice).toContain('Media permission was denied');
});

test('all route-facing intents convert unexpected rejections into serializable visible notices', async () => {
  const variant = { id: 'variant-1', mediaType: 'video' as const, reliable: true };
  const selection = { itemId: 'item-1', quality: 'balanced' as const, variant };
  const downloading: DownloadJob = {
    id: 'job-downloading', sourceUrl: 'https://example.com/downloading', status: 'downloading', selection,
    temporaryUri: 'file:///cache/downloading.mp4',
    transfer: { downloadUrl: 'https://cdn/downloading.mp4', filename: 'downloading.mp4', mediaType: 'video', mimeType: 'video/mp4' },
  };
  const paused: DownloadJob = {
    id: 'job-paused', sourceUrl: 'https://example.com/paused', status: 'paused_offline',
    resumeStatus: 'downloading', resumeJob: {
      ...downloading, id: 'job-paused', sourceUrl: 'https://example.com/paused',
    },
  };
  mockRepositories.jobs.listActive = jest.fn().mockResolvedValue([
    {
      id: 'job-selection', sourceUrl: 'https://example.com/selection', status: 'selection_required',
      preview: { items: [{ id: 'item-1', mediaType: 'video', variants: [variant] }] },
    },
    downloading,
    paused,
  ]);
  (background.list as jest.Mock).mockResolvedValue([{ id: downloading.id, status: 'downloading' }]);
  (network.getCurrent as jest.Mock).mockResolvedValue({ online: false });
  const { DownloadProvider, useDownloads } = loadContext();
  let context!: ReturnType<typeof useDownloads>;
  function Consumer() {
    context = useDownloads();
    return <Text>{JSON.stringify({ home: context.home, history: context.history, settings: context.settings })}</Text>;
  }
  await render(
    <DownloadProvider dependencies={{ background, clipboard, files, network, notifications: { complete: jest.fn() } }}>
      <Consumer />
    </DownloadProvider>,
  );
  await waitFor(() => expect(context.home.phase).toBe('paused_offline'));

  clipboard.getStringAsync.mockRejectedValueOnce(new Error('clipboard unavailable'));
  await expect(runIntent(() => context.pasteAndDownload())).resolves.toEqual({ kind: 'action_failed' });
  await waitFor(() => expect(context.home.cardDetail).toBe('clipboard unavailable'));

  (mockRepositories.jobs.save as jest.Mock).mockRejectedValueOnce(new Error('choose persistence failed'));
  await expect(runIntent(() => context.chooseMedia('job-selection', selection))).resolves.toBeUndefined();
  await waitFor(() => expect(context.home.cardDetail).toBe('choose persistence failed'));

  (mockRepositories.jobs.save as jest.Mock).mockRejectedValueOnce(new Error('cancel persistence failed'));
  await expect(runIntent(() => context.cancel(downloading.id))).resolves.toBeUndefined();
  await waitFor(() => expect(context.home.cardDetail).toBe('cancel persistence failed'));

  (network.getCurrent as jest.Mock).mockRejectedValueOnce(new Error('network status failed'));
  await expect(runIntent(() => context.retry(paused.id))).resolves.toBeUndefined();
  await waitFor(() => expect(context.home.cardDetail).toBe('network status failed'));

  (mockRepositories.history.findByJobId as jest.Mock).mockRejectedValueOnce(new Error('history lookup failed'));
  await expect(runIntent(() => context.deleteHistory(['missing'], 'history-only'))).resolves.toEqual({
    deletedIds: [], failures: [{ id: 'missing', kind: 'history_error', deviceDeleted: false }],
  });
  await waitFor(() => expect(context.history.notice).toBe('history lookup failed'));

  (mockRepositories.settings.save as jest.Mock).mockRejectedValueOnce(new Error('settings persistence failed'));
  await expect(runIntent(() => context.updateSettings({ alerts: false }))).resolves.toBeUndefined();
  await waitFor(() => expect(context.settings.notice).toBe('settings persistence failed'));

  (files.shareAsset as jest.Mock).mockRejectedValueOnce(new Error('share failed'));
  await expect(runIntent(() => context.share('ph://one'))).resolves.toBeUndefined();
  await waitFor(() => expect(context.history.notice).toBe('share failed'));

  (files.openAsset as jest.Mock).mockRejectedValueOnce(new Error('open failed'));
  await expect(runIntent(() => context.open('ph://one'))).resolves.toBeUndefined();
  await waitFor(() => expect(context.history.notice).toBe('open failed'));

  (files.cleanupTemporary as jest.Mock).mockRejectedValueOnce(new Error('cleanup failed'));
  await expect(runIntent(() => context.cleanupTemporary())).resolves.toBeUndefined();
  await waitFor(() => expect(context.settings.notice).toBe('cleanup failed'));

  (files.requestMediaPermission as jest.Mock).mockRejectedValueOnce(new Error('permission check failed'));
  await expect(runIntent(() => context.requestSaveLocationAccess())).resolves.toBeUndefined();
  await waitFor(() => expect(context.settings.notice).toBe('permission check failed'));
});
