import { createDownloadController } from './controller';
import type { DownloadPorts } from './ports';
import type { DownloadJob } from './types';

const sourceUrl = 'https://www.instagram.com/reel/restart';
const transfer = {
  downloadUrl: 'https://cdn.example/restart.mp4',
  filename: 'restart.mp4',
  mediaType: 'video' as const,
  mimeType: 'video/mp4',
};
const selection = {
  itemId: 'item-1',
  quality: 'balanced' as const,
  variant: { id: 'variant:item-1', mediaType: 'video' as const, reliable: true, height: 720 },
};

function restoredJob(): Extract<DownloadJob, { status: 'downloading' }> {
  return {
    id: 'job-restored',
    sourceUrl,
    status: 'downloading',
    selection,
    transfer,
    temporaryUri: 'file:///cache/restart.mp4',
  };
}

function createPorts(overrides: Partial<DownloadPorts> = {}): DownloadPorts {
  return {
    api: {
      preview: jest.fn().mockResolvedValue({
        kind: 'preview', platform: 'instagram', url: sourceUrl, thumbnail: 'https://images.example/restart.jpg',
      }),
      download: jest.fn().mockResolvedValue({
        kind: 'direct', platform: 'instagram', downloadUrl: transfer.downloadUrl,
        filename: transfer.filename, mediaType: transfer.mediaType, mimeType: transfer.mimeType,
      }),
    },
    history: {
      findBySourceUrl: jest.fn().mockResolvedValue(null),
      findByJobId: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    },
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([]),
    },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
    },
    files: {
      temporaryUri: jest.fn().mockReturnValue('file:///cache/restart.mp4'),
      export: jest.fn().mockResolvedValue({ assetUri: 'ph://restart' }),
      removeTemporary: jest.fn().mockResolvedValue(undefined),
      cleanupTemporary: jest.fn().mockResolvedValue({ removed: [], failed: [] }),
      requestMediaPermission: jest.fn().mockResolvedValue('granted'),
      deleteAsset: jest.fn().mockResolvedValue(undefined),
      shareAsset: jest.fn().mockResolvedValue(undefined),
      openAsset: jest.fn().mockResolvedValue(undefined),
    },
    notifications: { complete: jest.fn().mockResolvedValue('sent') },
    network: {
      getCurrent: jest.fn().mockResolvedValue({ online: true }),
      subscribe: jest.fn().mockReturnValue(() => undefined),
    },
    now: () => 123,
    id: () => 'job-new',
    ...overrides,
  };
}

test('hydrates persisted active jobs before listing native transfers and restores source reservations', async () => {
  const order: string[] = [];
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockImplementation(async () => {
        order.push('hydrate');
        return [restoredJob()];
      }),
    },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockImplementation(async () => {
        order.push('native');
        return [{ id: 'job-restored', status: 'downloading' as const }];
      }),
    },
  });
  const controller = createDownloadController(ports);

  await controller.reconcile();
  const duplicate = await controller.startFromText(sourceUrl);

  expect(order).toEqual(['hydrate', 'native']);
  expect(controller.get('job-restored')).toEqual(restoredJob());
  expect(duplicate).toEqual({ kind: 'duplicate', jobId: 'job-restored' });
  expect(ports.api.preview).not.toHaveBeenCalled();
});

test('reconciles native bytes into one persisted domain progress transition', async () => {
  const persisted = restoredJob();
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([persisted]),
    },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([{
        id: persisted.id, status: 'downloading', bytesWritten: 256, totalBytes: 1024,
      }]),
    },
  });
  const controller = createDownloadController(ports);

  await controller.reconcile();

  expect(controller.get(persisted.id)).toMatchObject({
    status: 'downloading', progress: { bytesWritten: 256, totalBytes: 1024 },
  });
  expect(ports.jobs.save).toHaveBeenCalledWith(expect.objectContaining({
    progress: { bytesWritten: 256, totalBytes: 1024 },
  }));
});

test('runs one trailing reconciliation when a terminal event arrives during an active pass', async () => {
  let release!: (events: Array<{ id: string; status: 'downloading' }>) => void;
  const list = jest.fn()
    .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
    .mockResolvedValueOnce([{
      id: 'job-restored', status: 'complete', fileUri: 'file:///cache/restart.mp4', sizeBytes: 4096,
    }]);
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([restoredJob()]),
    },
    background: { enqueue: jest.fn(), cancel: jest.fn(), list },
  });
  const controller = createDownloadController(ports);

  const first = controller.reconcile();
  for (let tick = 0; tick < 5 && list.mock.calls.length === 0; tick += 1) await Promise.resolve();
  expect(list).toHaveBeenCalledTimes(1);

  const second = controller.reconcile();
  release([{ id: 'job-restored', status: 'downloading' }]);
  await Promise.all([first, second]);

  expect(list).toHaveBeenCalledTimes(2);
  expect(controller.get('job-restored')).toMatchObject({ status: 'complete', assetUri: 'ph://restart' });
  expect(ports.history.save).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-restored' }));
});

test('runs the queued trailing pass when the active reconciliation fails', async () => {
  let rejectFirst!: (error: Error) => void;
  const list = jest.fn()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
    .mockResolvedValueOnce([{
      id: 'job-restored', status: 'complete', fileUri: 'file:///cache/restart.mp4', sizeBytes: 4096,
    }]);
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([restoredJob()]),
    },
    background: { enqueue: jest.fn(), cancel: jest.fn(), list },
  });
  const controller = createDownloadController(ports);

  const first = controller.reconcile();
  for (let tick = 0; tick < 5 && list.mock.calls.length === 0; tick += 1) await Promise.resolve();
  const second = controller.reconcile();
  rejectFirst(new Error('native list temporarily unavailable'));

  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  expect(list).toHaveBeenCalledTimes(2);
  expect(controller.get('job-restored')).toMatchObject({ status: 'complete', assetUri: 'ph://restart' });
});

test('persists downloading state and transfer metadata before enqueueing native work', async () => {
  const order: string[] = [];
  const ports = createPorts({
    jobs: {
      listActive: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (job: DownloadJob) => {
        if (job.status === 'downloading') order.push(`persist:${job.transfer?.filename}`);
      }),
    },
    background: {
      enqueue: jest.fn().mockImplementation(async () => { order.push('enqueue'); }),
      cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
    },
  });

  await createDownloadController(ports).startFromText(sourceUrl);

  expect(order).toEqual(['persist:restart.mp4', 'enqueue']);
  expect(ports.background.enqueue).toHaveBeenCalledWith(expect.objectContaining({
    filename: 'restart.mp4',
    mediaType: 'video',
    quality: 'balanced',
    platform: 'instagram',
    thumbnailUrl: 'https://images.example/restart.jpg',
    mediaIdentity: 'instagram:reel:restart',
    temporaryUri: 'file:///cache/restart.mp4',
  }));
});

test('process restart completion uses persisted transfer metadata and saves the final asset to history', async () => {
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([restoredJob()]),
    },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([{
        id: 'job-restored', status: 'complete', fileUri: 'file:///cache/restart.mp4', sizeBytes: 4096,
      }]),
    },
  });
  const controller = createDownloadController(ports);

  await controller.reconcile();

  expect(ports.files.export).toHaveBeenCalledWith('file:///cache/restart.mp4', {
    filename: 'restart.mp4', mediaType: 'video',
  });
  expect(ports.history.save).toHaveBeenCalledWith(expect.objectContaining({
    jobId: 'job-restored', assetUri: 'ph://restart', filename: 'restart.mp4', mediaType: 'video',
    mimeType: 'video/mp4', sizeBytes: 4096, quality: 'balanced', platform: 'instagram',
    mediaIdentity: 'instagram:reel:restart',
  }));
  expect(controller.get('job-restored')).toMatchObject({ status: 'complete', assetUri: 'ph://restart' });
});

test('permission-denied export becomes a typed retryable failure and retains the completed temp', async () => {
  const permissionError = Object.assign(new Error('Media permission denied.'), { reason: 'permission' as const });
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([restoredJob()]),
    },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([{ id: 'job-restored', status: 'complete', fileUri: 'file:///cache/restart.mp4' }]),
    },
    files: {
      temporaryUri: jest.fn().mockReturnValue('file:///cache/restart.mp4'),
      export: jest.fn().mockRejectedValue(permissionError),
      removeTemporary: jest.fn().mockResolvedValue(undefined),
      cleanupTemporary: jest.fn().mockResolvedValue({ removed: [], failed: [] }),
      requestMediaPermission: jest.fn().mockResolvedValue('granted'),
      deleteAsset: jest.fn().mockResolvedValue(undefined),
      shareAsset: jest.fn().mockResolvedValue(undefined),
      openAsset: jest.fn().mockResolvedValue(undefined),
    },
  });
  const controller = createDownloadController(ports);

  await controller.reconcile();

  expect(controller.get('job-restored')).toMatchObject({
    status: 'failed',
    failure: { reason: 'permission', retryable: true },
    recovery: { temporaryUri: 'file:///cache/restart.mp4', transfer },
  });
  expect(ports.history.save).not.toHaveBeenCalled();
  expect(ports.files.removeTemporary).not.toHaveBeenCalled();
});

test('cancellation persists the terminal state only after native cancellation and partial cleanup settle', async () => {
  const order: string[] = [];
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockImplementation(async (job: DownloadJob) => {
        if (job.status === 'cancelled') order.push('persist-cancelled');
      }),
      listActive: jest.fn().mockResolvedValue([restoredJob()]),
    },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockImplementation(async () => { order.push('native-cancel'); }),
      list: jest.fn().mockResolvedValue([]),
    },
    files: {
      temporaryUri: jest.fn().mockReturnValue('file:///cache/restart.mp4'),
      export: jest.fn().mockResolvedValue({ assetUri: 'ph://restart' }),
      removeTemporary: jest.fn().mockImplementation(async () => { order.push('cleanup'); }),
      cleanupTemporary: jest.fn().mockResolvedValue({ removed: [], failed: [] }),
      requestMediaPermission: jest.fn().mockResolvedValue('granted'),
      deleteAsset: jest.fn().mockResolvedValue(undefined),
      shareAsset: jest.fn().mockResolvedValue(undefined),
      openAsset: jest.fn().mockResolvedValue(undefined),
    },
  });
  const controller = createDownloadController(ports);
  await controller.hydrate();

  await controller.cancel('job-restored');

  expect(order).toEqual(['persist-cancelled', 'native-cancel', 'cleanup']);
});

test('failed active-runtime work removes its partial after durably persisting recovery state', async () => {
  const order: string[] = [];
  const ports = createPorts({
    jobs: {
      save: jest.fn().mockImplementation(async (job: DownloadJob) => {
        if (job.status === 'failed') order.push('persist-failed');
      }),
      listActive: jest.fn().mockResolvedValue([restoredJob()]),
    },
    background: {
      enqueue: jest.fn(), cancel: jest.fn(),
      list: jest.fn().mockResolvedValue([{ id: 'job-restored', status: 'failed', errorCode: 'connection_lost' }]),
    },
    files: {
      ...createPorts().files,
      removeTemporary: jest.fn().mockImplementation(async () => { order.push('cleanup-partial'); }),
    },
  });

  await createDownloadController(ports).reconcile();

  expect(order).toEqual(['persist-failed', 'cleanup-partial']);
});

test.each([
  ['queued', { id: 'job-restored', sourceUrl, status: 'queued' }],
  ['inspecting', { id: 'job-restored', sourceUrl, status: 'inspecting' }],
] as const)('restarts persisted %s inspection after hydration', async (_status, persisted) => {
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([persisted]) },
  });
  await createDownloadController(ports).reconcile();
  expect(ports.api.preview).toHaveBeenCalledWith(sourceUrl);
  expect(ports.background.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-restored' }));
});

test('enqueues persisted preparing work and re-enqueues missing active-runtime downloading work', async () => {
  const preparing: DownloadJob = {
    id: 'job-preparing', sourceUrl, status: 'preparing', selection: { ...selection, variant: { ...selection.variant, transfer } },
  };
  const downloading = restoredJob();
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([preparing, downloading]) },
  });

  await createDownloadController(ports).reconcile();

  expect(ports.background.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-preparing' }));
  expect(ports.background.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-restored' }));
});

test('keeps paused work offline and resumes its persisted downloading state when online', async () => {
  const paused: DownloadJob = {
    id: 'job-paused', sourceUrl, status: 'paused_offline', resumeStatus: 'downloading', resumeJob: restoredJob(),
  };
  const network = {
    getCurrent: jest.fn().mockResolvedValue({ online: false }),
    subscribe: jest.fn().mockReturnValue(() => undefined),
  };
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([paused]) },
    network,
  });
  const controller = createDownloadController(ports);

  await controller.reconcile();
  expect(ports.background.enqueue).not.toHaveBeenCalled();
  await controller.setOnline(true);
  expect(ports.background.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-restored' }));
});

test('retry keeps paused work durable and visible when the current network is offline', async () => {
  const paused: DownloadJob = {
    id: 'job-restored', sourceUrl, status: 'paused_offline', resumeStatus: 'downloading', resumeJob: restoredJob(),
  };
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([paused]) },
    network: {
      getCurrent: jest.fn().mockResolvedValue({ online: false }),
      subscribe: jest.fn().mockReturnValue(() => undefined),
    },
  });
  const controller = createDownloadController(ports);
  await controller.hydrate();

  await expect(controller.retry(paused.id)).resolves.toBe(paused);
  expect(controller.get(paused.id)).toBe(paused);
  expect(ports.jobs.save).not.toHaveBeenCalled();
  expect(ports.background.enqueue).not.toHaveBeenCalled();
});

test.each([
  ['queued', {
    id: 'job-queued', sourceUrl, status: 'paused_offline' as const, resumeStatus: 'queued' as const,
    resumeJob: { id: 'job-queued', sourceUrl, status: 'queued' as const },
  }],
  ['preparing', {
    id: 'job-preparing', sourceUrl, status: 'paused_offline' as const, resumeStatus: 'preparing' as const,
    resumeJob: {
      id: 'job-preparing', sourceUrl, status: 'preparing' as const,
      selection: { ...selection, variant: { ...selection.variant, transfer } },
    },
  }],
  ['downloading', {
    id: 'job-restored', sourceUrl, status: 'paused_offline' as const, resumeStatus: 'downloading' as const,
    resumeJob: restoredJob(),
  }],
] as const)('retry checks online state, persists ONLINE, and resumes prior %s work once', async (_label, paused) => {
  const order: string[] = [];
  const ports = createPorts({
    jobs: {
      listActive: jest.fn().mockResolvedValue([paused]),
      save: jest.fn().mockImplementation(async (job: DownloadJob) => { order.push(`persist:${job.status}`); }),
    },
    network: {
      getCurrent: jest.fn().mockResolvedValue({ online: true }),
      subscribe: jest.fn().mockReturnValue(() => undefined),
    },
    background: {
      enqueue: jest.fn().mockImplementation(async () => { order.push('enqueue'); }),
      cancel: jest.fn(), list: jest.fn(),
    },
  });
  const controller = createDownloadController(ports);
  await controller.hydrate();

  const result = await controller.retry(paused.id);

  expect(order[0]).toBe(`persist:${paused.resumeStatus}`);
  if (paused.resumeStatus === 'queued') {
    expect(ports.api.preview).toHaveBeenCalledTimes(1);
  } else {
    expect(ports.background.enqueue).toHaveBeenCalledTimes(1);
  }
  expect(result).toBe(controller.get(paused.id));
});

test('coalesces concurrent retry calls for the same paused job without duplicate resume side effects', async () => {
  const paused: DownloadJob = {
    id: 'job-restored', sourceUrl, status: 'paused_offline', resumeStatus: 'downloading', resumeJob: restoredJob(),
  };
  let releaseNetwork!: (state: { online: boolean }) => void;
  const networkState = new Promise<{ online: boolean }>((resolve) => { releaseNetwork = resolve; });
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([paused]) },
    network: {
      getCurrent: jest.fn().mockReturnValue(networkState),
      subscribe: jest.fn().mockReturnValue(() => undefined),
    },
  });
  const controller = createDownloadController(ports);
  await controller.hydrate();

  const first = controller.retry(paused.id);
  const second = controller.retry(paused.id);
  releaseNetwork({ online: true });
  const [firstResult, secondResult] = await Promise.all([first, second]);

  expect(ports.network?.getCurrent).toHaveBeenCalledTimes(1);
  expect(ports.jobs.save).toHaveBeenCalledTimes(1);
  expect(ports.background.enqueue).toHaveBeenCalledTimes(1);
  expect(firstResult).toBe(controller.get(paused.id));
  expect(secondResult).toBe(firstResult);
});

test.each([
  ['temporary export', { ...restoredJob(), status: 'exporting' as const }],
  ['persisted asset', { ...restoredJob(), status: 'exporting' as const, assetUri: 'ph://restart' }],
])('finalizes persisted exporting state from %s without a native event', async (_label, exporting) => {
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([exporting]) },
  });
  const controller = createDownloadController(ports);
  await controller.reconcile();
  expect(controller.get(exporting.id)).toMatchObject({ status: 'complete', assetUri: 'ph://restart' });
});

test('hydrates permission recovery without auto-export and retries it explicitly after restart', async () => {
  const failed: DownloadJob = {
    id: 'job-permission', sourceUrl, status: 'failed',
    failure: { reason: 'permission', retryable: true },
    recovery: { selection, temporaryUri: 'file:///cache/restart.mp4', transfer },
  };
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([failed]) },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined), cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([{ id: failed.id, status: 'complete', fileUri: 'file:///cache/restart.mp4' }]),
    },
  });
  const controller = createDownloadController(ports);
  await controller.reconcile();
  expect(ports.files.export).not.toHaveBeenCalled();
  await controller.retry(failed.id);
  expect(controller.get(failed.id)).toMatchObject({ status: 'complete' });
});

test('late preview continuation cannot revive a durably cancelled job', async () => {
  let release!: (value: { kind: 'preview'; platform: string; url: string }) => void;
  const preview = new Promise<{ kind: 'preview'; platform: string; url: string }>((resolve) => { release = resolve; });
  const ports = createPorts({ api: { preview: jest.fn().mockReturnValue(preview), download: jest.fn() } });
  const controller = createDownloadController(ports);
  const starting = controller.startFromText(sourceUrl);
  await Promise.resolve();
  await Promise.resolve();
  await controller.cancel('job-new');
  release({ kind: 'preview', platform: 'instagram', url: sourceUrl });
  await starting;
  expect(controller.get('job-new')).toMatchObject({ status: 'cancelled' });
  expect(ports.api.download).not.toHaveBeenCalled();
});

test('deletes an asset best-effort when export resolves after durable cancellation', async () => {
  let release!: (value: { assetUri: string }) => void;
  const exporting = new Promise<{ assetUri: string }>((resolve) => { release = resolve; });
  const ports = createPorts({
    jobs: { save: jest.fn().mockResolvedValue(undefined), listActive: jest.fn().mockResolvedValue([restoredJob()]) },
    background: {
      enqueue: jest.fn().mockResolvedValue(undefined), cancel: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([{ id: 'job-restored', status: 'complete', fileUri: 'file:///cache/restart.mp4' }]),
    },
    files: {
      temporaryUri: jest.fn().mockReturnValue('file:///cache/restart.mp4'),
      export: jest.fn().mockReturnValue(exporting), removeTemporary: jest.fn().mockResolvedValue(undefined),
      deleteAsset: jest.fn().mockResolvedValue(undefined), shareAsset: jest.fn(), openAsset: jest.fn(),
      cleanupTemporary: jest.fn().mockResolvedValue({ removed: [], failed: [] }),
      requestMediaPermission: jest.fn().mockResolvedValue('granted'),
    },
  });
  const controller = createDownloadController(ports);
  const reconciling = controller.reconcile();
  for (let turn = 0; turn < 20 && (ports.files.export as jest.Mock).mock.calls.length === 0; turn += 1) {
    await Promise.resolve();
  }
  expect(ports.files.export).toHaveBeenCalledTimes(1);
  await controller.cancel('job-restored');
  release({ assetUri: 'ph://late' });
  await reconciling;
  expect(ports.files.deleteAsset).toHaveBeenCalledWith('ph://late');
  expect(ports.history.save).not.toHaveBeenCalled();
  expect(controller.get('job-restored')).toMatchObject({ status: 'cancelled' });
});
