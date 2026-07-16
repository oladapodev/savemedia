import type { DownloadJob } from './types';
import { createDownloadController } from './controller';
import type { DownloadPorts } from './ports';

const sourceUrl = 'https://www.instagram.com/reel/abc';
const downloadUrl = 'https://cdn.example.com/clip.mp4';

function createFiles(overrides: Partial<DownloadPorts['files']> = {}): DownloadPorts['files'] {
  return {
    temporaryUri: jest.fn().mockReturnValue('file:///tmp/clip.mp4'),
    importIncoming: jest.fn().mockResolvedValue({
      temporaryUri: 'file:///tmp/clip.mp4', sizeBytes: 128, fingerprint: 'local:clip:128',
    }),
    export: jest.fn().mockResolvedValue({ assetUri: 'ph://clip' }),
    removeTemporary: jest.fn().mockResolvedValue(undefined),
    cleanupTemporary: jest.fn().mockResolvedValue({ removed: [], failed: [] }),
    requestMediaPermission: jest.fn().mockResolvedValue('granted'),
    deleteAsset: jest.fn().mockResolvedValue(undefined),
    shareAsset: jest.fn().mockResolvedValue(undefined),
    openAsset: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createPorts(overrides: Partial<DownloadPorts> = {}): DownloadPorts {
  return {
    api: {
      preview: jest.fn().mockResolvedValue({
        kind: 'preview',
        platform: 'instagram',
        url: sourceUrl,
        title: 'A reel',
      }),
      download: jest.fn().mockResolvedValue({
        kind: 'direct',
        platform: 'instagram',
      downloadUrl,
      filename: 'clip.mp4',
      mediaType: 'video',
      mimeType: 'video/mp4',
      }),
    },
    history: {
      findBySourceUrl: jest.fn().mockResolvedValue(null),
      findByMediaIdentity: jest.fn().mockResolvedValue(null),
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
    files: createFiles(),
    notifications: { complete: jest.fn().mockResolvedValue('sent') },
    now: () => 123,
    id: () => 'job-1',
    ...overrides,
  };
}

describe('download controller', () => {
  test('passes the wrapper concrete audio MIME unchanged to native enqueue', async () => {
    const ports = createPorts({
      api: {
        preview: jest.fn().mockResolvedValue({
          kind: 'preview', platform: 'youtube', url: sourceUrl, mediaType: 'audio',
        }),
        download: jest.fn().mockResolvedValue({
          kind: 'direct', platform: 'youtube', downloadUrl: 'https://cdn.example/song.mp3',
          filename: 'song.mp3', mediaType: 'audio', mimeType: 'audio/mpeg',
        }),
      },
    });

    await createDownloadController(ports).startFromText(sourceUrl, 'audio');

    expect(ports.background.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://cdn.example/song.mp3', filename: 'song.mp3',
      mediaType: 'audio', mimeType: 'audio/mpeg',
    }));
  });
  test.each([
    ['image', 'image/jpeg', 'photo.jpg', 'content://share/photo', 'local:image:128'],
    ['video', 'video/mp4', 'clip.mp4', 'file:///group/clip.mp4', 'local:video:128'],
  ] as const)('imports, validates, exports, and records a direct %s without API or background work', async (
    mediaType,
    mimeType,
    filename,
    sourceUri,
    fingerprint,
  ) => {
    const ports = createPorts({
      files: createFiles({
        temporaryUri: jest.fn().mockReturnValue(`file:///tmp/${filename}`),
        importIncoming: jest.fn().mockResolvedValue({
          temporaryUri: `file:///tmp/${filename}`, sizeBytes: 128, fingerprint,
        }),
        export: jest.fn().mockResolvedValue({ assetUri: `ph://${mediaType}` }),
      }),
    });
    const controller = createDownloadController(ports);

    const result = await controller.startFromDirectFiles([{
      sourceUri, filename, mediaType, mimeType, sizeBytes: 128,
    }]);

    expect(result).toMatchObject({ kind: 'started', job: { status: 'complete', assetUri: `ph://${mediaType}` } });
    expect(ports.files.importIncoming).toHaveBeenCalledWith(expect.objectContaining({
      sourceUri, filename, mediaType, mimeType, declaredSizeBytes: 128,
    }));
    expect(ports.files.export).toHaveBeenCalledWith(`file:///tmp/${filename}`, { filename, mediaType });
    expect(ports.history.save).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: 'shared-media://job-1', filename, mediaType, mimeType, sizeBytes: 128,
      quality: 'original', platform: 'device', mediaIdentity: fingerprint, sourceKind: 'device-share',
    }));
    expect(ports.api.preview).not.toHaveBeenCalled();
    expect(ports.api.download).not.toHaveBeenCalled();
    expect(ports.background.enqueue).not.toHaveBeenCalled();
  });

  test('imports a bounded media set and persists selection-required state before exporting one choice', async () => {
    const importIncoming = jest
      .fn()
      .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/one.jpg', sizeBytes: 10, fingerprint: 'local:one:10' })
      .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/two.mp4', sizeBytes: 20, fingerprint: 'local:two:20' });
    const ports = createPorts({
      files: createFiles({
        temporaryUri: jest.fn().mockImplementation(({ filename }: { filename: string }) => `file:///tmp/${filename}`),
        importIncoming,
      }),
    });
    const controller = createDownloadController(ports);

    const result = await controller.startFromDirectFiles([
      { sourceUri: 'content://share/one', filename: 'one.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 10 },
      { sourceUri: 'content://share/two', filename: 'two.mp4', mediaType: 'video', mimeType: 'video/mp4', sizeBytes: 20 },
    ]);

    expect(result).toMatchObject({ kind: 'selection_required', job: { status: 'selection_required' } });
    if (result.kind !== 'selection_required' || result.job.status !== 'selection_required') {
      throw new Error('expected a selection-required result');
    }
    expect(result.job.preview.items).toHaveLength(2);
    expect(ports.files.export).not.toHaveBeenCalled();
    expect(ports.api.preview).not.toHaveBeenCalled();

    const selected = result.job.preview.items[1].variants[0];
    await expect(controller.choose(result.job.id, {
      itemId: result.job.preview.items[1].id,
      quality: 'original',
      variant: selected,
    })).resolves.toMatchObject({ status: 'complete', assetUri: 'ph://clip' });
    expect(ports.files.export).toHaveBeenCalledWith('file:///tmp/two.mp4', {
      filename: 'two.mp4', mediaType: 'video',
    });
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/one.jpg');
    expect(ports.background.enqueue).not.toHaveBeenCalled();
  });

  test('retains native queue ownership through selection-required imports without staging cleanup', async () => {
    const cleanupIncomingStaging = jest.fn().mockResolvedValue(undefined);
    const ports = createPorts({
      files: createFiles({
        temporaryUri: jest.fn().mockImplementation(({ filename }: { filename: string }) => `file:///tmp/${filename}`),
        importIncoming: jest.fn()
          .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/one.jpg', sizeBytes: 10, fingerprint: 'local:native-one:10' })
          .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/two.jpg', sizeBytes: 20, fingerprint: 'local:native-two:20' }),
        cleanupIncomingStaging,
      }),
    });
    const files = [
      { sourceUri: 'file:///cache/imediasave-shares/batch/one.jpg', filename: 'one.jpg', mediaType: 'image' as const, mimeType: 'image/jpeg', sizeBytes: 10, sourceOwnership: 'native-share-queue' as const },
      { sourceUri: 'file:///cache/imediasave-shares/batch/two.jpg', filename: 'two.jpg', mediaType: 'image' as const, mimeType: 'image/jpeg', sizeBytes: 20, sourceOwnership: 'native-share-queue' as const },
    ];

    const result = await createDownloadController(ports).startFromDirectFiles(files);

    expect(result).toMatchObject({ kind: 'selection_required' });
    expect(ports.files.importIncoming).toHaveBeenNthCalledWith(1, expect.objectContaining({
      sourceOwnership: 'native-share-queue',
    }));
    expect(ports.files.importIncoming).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sourceOwnership: 'native-share-queue',
    }));
    expect(cleanupIncomingStaging).not.toHaveBeenCalled();
  });

  test('stops a fingerprint duplicate before device export and removes its imported temporary file', async () => {
    const ports = createPorts({
      history: {
        findBySourceUrl: jest.fn().mockResolvedValue(null),
        findByMediaIdentity: jest.fn().mockResolvedValue({ jobId: 'existing-local', sourceUrl: 'shared-media://old' }),
        findByJobId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(undefined),
      },
    });

    const result = await createDownloadController(ports).startFromDirectFiles([{
      sourceUri: 'content://share/clip', filename: 'clip.mp4', mediaType: 'video', mimeType: 'video/mp4', sizeBytes: 128,
    }]);

    expect(result).toEqual({ kind: 'duplicate', jobId: 'existing-local' });
    expect(ports.files.export).not.toHaveBeenCalled();
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/clip.mp4');
    expect(ports.api.preview).not.toHaveBeenCalled();
  });

  test('surfaces inaccessible direct imports as typed failures without calling the API', async () => {
    const importError = Object.assign(new Error('Shared media could not be accessed.'), { reason: 'invalid_file' as const });
    const ports = createPorts({ files: createFiles({ importIncoming: jest.fn().mockRejectedValue(importError) }) });

    const result = await createDownloadController(ports).startFromDirectFiles([{
      sourceUri: 'content://share/missing', filename: 'missing.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 100,
    }]);

    expect(result).toMatchObject({ kind: 'failed', job: { status: 'failed', failure: { reason: 'invalid_file' } } });
    expect(ports.api.preview).not.toHaveBeenCalled();
  });

  test('surfaces direct history failure as retryable storage recovery without re-exporting', async () => {
    const history = {
      findBySourceUrl: jest.fn().mockResolvedValue(null),
      findByMediaIdentity: jest.fn().mockResolvedValue(null),
      findByJobId: jest.fn().mockResolvedValue(null),
      save: jest.fn()
        .mockRejectedValueOnce(new Error('sqlite database unavailable'))
        .mockResolvedValueOnce(undefined),
    };
    const files = createFiles();
    const ports = createPorts({ history, files });
    const controller = createDownloadController(ports);

    const result = await controller.startFromDirectFiles([{
      sourceUri: 'file:///group/clip.mp4', filename: 'clip.mp4', mediaType: 'video',
      mimeType: 'video/mp4', sizeBytes: 128, sourceOwnership: 'expo-sharing-staging',
    }]);

    expect(result).toMatchObject({
      kind: 'failed',
      job: {
        status: 'failed',
        failure: { reason: 'storage', retryable: true },
        recovery: {
          temporaryUri: 'file:///tmp/clip.mp4',
          assetUri: 'ph://clip',
          transfer: { sourceKind: 'device-share' },
        },
      },
    });
    expect(files.removeTemporary).not.toHaveBeenCalled();
    expect(files.export).toHaveBeenCalledTimes(1);

    await expect(controller.retry('job-1')).resolves.toMatchObject({ status: 'complete', assetUri: 'ph://clip' });
    expect(files.export).toHaveBeenCalledTimes(1);
    expect(history.save).toHaveBeenCalledTimes(2);
    expect(files.removeTemporary).toHaveBeenCalledWith('file:///tmp/clip.mp4');
  });

  test('rejects duplicate fingerprints inside one media set and cleans every imported file', async () => {
    const ports = createPorts({
      files: createFiles({
        temporaryUri: jest.fn().mockImplementation(({ filename }: { filename: string }) => `file:///tmp/${filename}`),
        importIncoming: jest
          .fn()
          .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/one.jpg', sizeBytes: 10, fingerprint: 'local:same:10' })
          .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/two.jpg', sizeBytes: 10, fingerprint: 'local:same:10' }),
      }),
    });

    const result = await createDownloadController(ports).startFromDirectFiles([
      { sourceUri: 'content://share/one', filename: 'one.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 10 },
      { sourceUri: 'content://share/two', filename: 'two.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 10 },
    ]);

    expect(result).toMatchObject({ kind: 'failed', job: { failure: { reason: 'invalid_file' } } });
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/one.jpg');
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/two.jpg');
    expect(ports.files.export).not.toHaveBeenCalled();
  });

  test('cancels selection-required direct media by cleaning imports without native download work', async () => {
    const ports = createPorts({
      files: createFiles({
        temporaryUri: jest.fn().mockImplementation(({ filename }: { filename: string }) => `file:///tmp/${filename}`),
        importIncoming: jest
          .fn()
          .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/one.jpg', sizeBytes: 10, fingerprint: 'local:one:10' })
          .mockResolvedValueOnce({ temporaryUri: 'file:///tmp/two.jpg', sizeBytes: 20, fingerprint: 'local:two:20' }),
      }),
    });
    const controller = createDownloadController(ports);
    const result = await controller.startFromDirectFiles([
      { sourceUri: 'content://share/one', filename: 'one.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 10 },
      { sourceUri: 'content://share/two', filename: 'two.jpg', mediaType: 'image', mimeType: 'image/jpeg', sizeBytes: 20 },
    ]);
    if (result.kind !== 'selection_required') throw new Error('expected selection-required');

    await controller.cancel(result.job.id);

    expect(controller.get(result.job.id)).toMatchObject({ status: 'cancelled' });
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/one.jpg');
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/two.jpg');
    expect(ports.background.cancel).not.toHaveBeenCalled();
  });

  test('normalizes shared text, publishes reducer state, and auto-starts one clear result', async () => {
    const ports = createPorts();
    const published: DownloadJob[] = [];
    const controller = createDownloadController(ports, (job) => published.push(job));

    const result = await controller.startFromText(`Save ${sourceUrl}#comments`);

    expect(result).toMatchObject({ kind: 'started', job: { id: 'job-1', status: 'downloading' } });
    expect(ports.api.preview).toHaveBeenCalledWith(sourceUrl);
    expect(ports.api.download).toHaveBeenCalledWith(sourceUrl, 'balanced');
    expect(ports.background.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1', url: downloadUrl, filename: 'clip.mp4' }),
    );
    expect(published.map((job) => job.status)).toEqual([
      'queued',
      'inspecting',
      'preparing',
      'downloading',
    ]);
  });

  test.each([
    ['image', 'original', 'image/jpeg', 'jpg'],
    ['audio', 'audio', 'audio/mpeg', 'mp3'],
  ] as const)(
    'smart auto-saves one direct %s result with %s selection',
    async (mediaType, quality, expectedMimeType, extension) => {
      const ports = createPorts({
        api: {
          preview: jest.fn().mockResolvedValue({
            kind: 'preview',
            platform: 'instagram',
            url: sourceUrl,
          }),
          download: jest.fn().mockResolvedValue({
            kind: 'direct',
            platform: 'instagram',
            downloadUrl,
            filename: `clip.${extension}`,
            mediaType,
            mimeType: expectedMimeType,
          }),
        },
      });

      const result = await createDownloadController(ports).startFromText(sourceUrl);

      expect(result).toMatchObject({
        kind: 'started',
        job: { status: 'downloading', selection: { quality } },
      });
      expect(ports.background.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: expectedMimeType }),
      );
    },
  );

  test('keeps a multi-item picker in selection_required', async () => {
    const ports = createPorts({
      api: {
        preview: jest.fn().mockResolvedValue({
          kind: 'preview',
          platform: 'instagram',
          url: sourceUrl,
        }),
        download: jest.fn().mockResolvedValue({
          kind: 'picker',
          platform: 'instagram',
          items: [
            { id: 'item-1', downloadUrl, filename: 'one.jpg', mediaType: 'image' },
            { id: 'item-2', downloadUrl: `${downloadUrl}?2`, filename: 'two.jpg', mediaType: 'image' },
          ],
        }),
      },
    });

    const result = await createDownloadController(ports).startFromText(sourceUrl);

    expect(result).toMatchObject({ kind: 'selection_required', job: { status: 'selection_required' } });
    expect(ports.background.enqueue).not.toHaveBeenCalled();
  });

  test('checks duplicates before smart auto-save', async () => {
    const ports = createPorts({
      history: {
        findBySourceUrl: jest.fn().mockResolvedValue({ jobId: 'old-job', sourceUrl }),
        findByJobId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(undefined),
      },
    });

    const result = await createDownloadController(ports).startFromText(sourceUrl);

    expect(result).toEqual({ kind: 'duplicate', jobId: 'old-job' });
    expect(ports.api.preview).not.toHaveBeenCalled();
  });

  test('reserves a normalized source before concurrent async duplicate checks', async () => {
    let resolveHistory!: (value: null) => void;
    const historyLookup = new Promise<null>((resolve) => {
      resolveHistory = resolve;
    });
    const ports = createPorts({
      history: {
        findBySourceUrl: jest.fn().mockReturnValue(historyLookup),
        findByJobId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(undefined),
      },
      id: jest.fn().mockReturnValue('job-concurrent'),
    });
    const controller = createDownloadController(ports);

    const first = controller.startFromText(`${sourceUrl}#first`);
    const second = controller.startFromText(`${sourceUrl}#second`);
    expect(ports.api.preview).not.toHaveBeenCalled();

    resolveHistory(null);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toMatchObject({ kind: 'started' });
    expect(secondResult).toEqual({ kind: 'duplicate', jobId: 'job-concurrent' });
    expect(ports.history.findBySourceUrl).toHaveBeenCalledTimes(1);
    expect(ports.api.preview).toHaveBeenCalledTimes(1);
    expect(ports.background.enqueue).toHaveBeenCalledTimes(1);
  });

  test('releases a source reservation when the history lookup fails before persistence', async () => {
    const history = {
      ...createPorts().history,
      findBySourceUrl: jest
        .fn()
        .mockRejectedValueOnce(new Error('history unavailable'))
        .mockResolvedValueOnce(null),
    };
    const ports = createPorts({
      history,
      id: jest.fn().mockReturnValueOnce('job-history-failed').mockReturnValue('job-history-retry'),
    });
    const controller = createDownloadController(ports);

    await expect(controller.startFromText(sourceUrl)).rejects.toThrow('history unavailable');
    await expect(controller.startFromText(sourceUrl)).resolves.toMatchObject({
      kind: 'started',
      job: { id: 'job-history-retry' },
    });
  });

  test('releases a source reservation when the initial job save fails', async () => {
    const jobs = {
      save: jest
        .fn()
        .mockRejectedValueOnce(new Error('job store unavailable'))
        .mockResolvedValue(undefined),
      listActive: jest.fn().mockResolvedValue([]),
    };
    const ports = createPorts({
      jobs,
      id: jest.fn().mockReturnValueOnce('job-save-failed').mockReturnValue('job-save-retry'),
    });
    const controller = createDownloadController(ports);

    await expect(controller.startFromText(sourceUrl)).rejects.toThrow('job store unavailable');
    await expect(controller.startFromText(sourceUrl)).resolves.toMatchObject({
      kind: 'started',
      job: { id: 'job-save-retry' },
    });
  });

  test('reserves canonical media identity across concurrent YouTube host and tracking aliases', async () => {
    let releaseLookup!: (value: null) => void;
    const lookup = new Promise<null>((resolve) => { releaseLookup = resolve; });
    const youtube = 'https://www.youtube.com/watch?v=video-one&utm_source=share';
    const alias = 'https://youtu.be/video-one?si=tracking';
    const ports = createPorts({
      history: {
        findBySourceUrl: jest.fn().mockReturnValue(lookup),
        findByJobId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(undefined),
      },
      id: jest.fn().mockReturnValue('job-youtube'),
    });
    const controller = createDownloadController(ports);

    const first = controller.startFromText(youtube);
    const second = controller.startFromText(alias);
    releaseLookup(null);

    expect(await second).toEqual({ kind: 'duplicate', jobId: 'job-youtube' });
    await first;
    expect(ports.history.findBySourceUrl).toHaveBeenCalledTimes(1);
  });

  test('releases the source reservation after a synchronous typed API failure', async () => {
    const ports = createPorts({
      api: {
        preview: jest
          .fn()
          .mockResolvedValueOnce({
            kind: 'failure',
            reason: 'unsupported',
            retryable: false,
            message: 'unsupported',
          })
          .mockResolvedValue({
            kind: 'preview',
            platform: 'instagram',
            url: sourceUrl,
          }),
        download: jest.fn().mockResolvedValue({
          kind: 'direct',
          platform: 'instagram',
          downloadUrl,
          filename: 'clip.mp4',
          mediaType: 'video',
        }),
      },
      id: jest
        .fn()
        .mockReturnValueOnce('job-api-failed')
        .mockReturnValue('job-api-retry'),
    });
    const controller = createDownloadController(ports);

    const failed = await controller.startFromText(sourceUrl);
    const retried = await controller.startFromText(sourceUrl);

    expect(failed).toMatchObject({ kind: 'failed', job: { id: 'job-api-failed' } });
    expect(retried).toMatchObject({ kind: 'started', job: { id: 'job-api-retry' } });
  });

  test('releases the source reservation after background enqueue fails', async () => {
    const ports = createPorts({
      background: {
        enqueue: jest
          .fn()
          .mockRejectedValueOnce(new Error('queue unavailable'))
          .mockResolvedValueOnce(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue([]),
      },
      id: jest
        .fn()
        .mockReturnValueOnce('job-enqueue-failed')
        .mockReturnValue('job-enqueue-retry'),
    });
    const controller = createDownloadController(ports);

    const failed = await controller.startFromText(sourceUrl);
    const retried = await controller.startFromText(sourceUrl);

    expect(failed).toMatchObject({ kind: 'failed', job: { id: 'job-enqueue-failed' } });
    expect(retried).toMatchObject({ kind: 'started', job: { id: 'job-enqueue-retry' } });
  });

  test('cancellation releases its reservation without a stale failure deleting the newer job', async () => {
    let resolveFirstPreview!: (value: {
      kind: 'failure';
      reason: 'unsupported';
      retryable: false;
      message: string;
    }) => void;
    let markFirstPreviewStarted!: () => void;
    const firstPreviewStarted = new Promise<void>((resolve) => {
      markFirstPreviewStarted = resolve;
    });
    const firstPreview = new Promise<{
      kind: 'failure';
      reason: 'unsupported';
      retryable: false;
      message: string;
    }>((resolve) => {
      resolveFirstPreview = resolve;
    });
    const ports = createPorts({
      api: {
        preview: jest
          .fn()
          .mockImplementationOnce(() => {
            markFirstPreviewStarted();
            return firstPreview;
          })
          .mockResolvedValue({
            kind: 'preview',
            platform: 'instagram',
            url: sourceUrl,
          }),
        download: jest.fn().mockResolvedValue({
          kind: 'direct',
          platform: 'instagram',
          downloadUrl,
          filename: 'clip.mp4',
          mediaType: 'video',
        }),
      },
      id: jest
        .fn()
        .mockReturnValueOnce('job-cancelled')
        .mockReturnValue('job-newer'),
    });
    const controller = createDownloadController(ports);

    const staleStart = controller.startFromText(sourceUrl);
    await firstPreviewStarted;
    await controller.cancel('job-cancelled');
    const newer = await controller.startFromText(sourceUrl);
    resolveFirstPreview({
      kind: 'failure',
      reason: 'unsupported',
      retryable: false,
      message: 'stale failure',
    });
    await staleStart;
    const duplicate = await controller.startFromText(sourceUrl);

    expect(newer).toMatchObject({ kind: 'started', job: { id: 'job-newer' } });
    expect(duplicate).toEqual({ kind: 'duplicate', jobId: 'job-newer' });
  });

  test('retries a retryable API failure once before surfacing a typed failed job', async () => {
    const ports = createPorts({
      api: {
        preview: jest
          .fn()
          .mockResolvedValueOnce({ kind: 'failure', reason: 'provider', retryable: true, message: 'busy' })
          .mockResolvedValueOnce({ kind: 'failure', reason: 'provider', retryable: true, message: 'busy' }),
        download: jest.fn(),
      },
    });

    const result = await createDownloadController(ports).startFromText(sourceUrl);

    expect(ports.api.preview).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ kind: 'failed', job: { status: 'failed', failure: { reason: 'provider' } } });
  });

  test('shares one automatic retry budget across preview and download', async () => {
    const ports = createPorts({
      api: {
        preview: jest
          .fn()
          .mockResolvedValueOnce({ kind: 'failure', reason: 'provider', retryable: true, message: 'preview busy' })
          .mockResolvedValueOnce({ kind: 'preview', platform: 'instagram', url: sourceUrl }),
        download: jest
          .fn()
          .mockResolvedValueOnce({ kind: 'failure', reason: 'provider', retryable: true, message: 'download busy' })
          .mockResolvedValueOnce({
            kind: 'direct',
            platform: 'instagram',
            downloadUrl,
            filename: 'clip.mp4',
            mediaType: 'video',
          }),
      },
    });

    const result = await createDownloadController(ports).startFromText(sourceUrl);

    expect(ports.api.preview).toHaveBeenCalledTimes(2);
    expect(ports.api.download).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      kind: 'failed',
      job: { failure: { reason: 'provider', message: 'download busy' } },
    });
  });

  test('uses the flow retry for download when preview did not consume it', async () => {
    const ports = createPorts();
    (ports.api.download as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce({ kind: 'failure', reason: 'provider', retryable: true, message: 'busy' })
      .mockResolvedValueOnce({
        kind: 'direct',
        platform: 'instagram',
        downloadUrl,
        filename: 'clip.mp4',
        mediaType: 'video',
      });

    const result = await createDownloadController(ports).startFromText(sourceUrl);

    expect(ports.api.preview).toHaveBeenCalledTimes(1);
    expect(ports.api.download).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ kind: 'started' });
  });

  test('does not automatically retry a network failure', async () => {
    const ports = createPorts({
      api: {
        preview: jest.fn().mockResolvedValue({
          kind: 'failure',
          reason: 'network',
          retryable: true,
          message: 'offline',
        }),
        download: jest.fn(),
      },
    });

    await createDownloadController(ports).startFromText(sourceUrl);

    expect(ports.api.preview).toHaveBeenCalledTimes(1);
  });

  test.each(['unsupported', 'private', 'not_found'] as const)(
    'preserves the typed %s wrapper failure in the job state',
    async (reason) => {
      const ports = createPorts({
        api: {
          preview: jest.fn().mockResolvedValue({
            kind: 'failure',
            reason,
            retryable: false,
            message: `wrapper ${reason}`,
          }),
          download: jest.fn(),
        },
      });

      const result = await createDownloadController(ports).startFromText(sourceUrl);

      expect(result).toMatchObject({
        kind: 'failed',
        job: { failure: { reason, retryable: false, message: `wrapper ${reason}` } },
      });
    },
  );

  test('cancels the job even when native cancellation and temporary cleanup reject', async () => {
    const ports = createPorts({
      background: {
        enqueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockRejectedValue(new Error('native cancel failed')),
        list: jest.fn().mockResolvedValue([]),
      },
      files: createFiles({
        export: jest.fn().mockResolvedValue({ assetUri: 'ph://clip' }),
        removeTemporary: jest.fn().mockRejectedValue(new Error('cleanup failed')),
      }),
    });
    const controller = createDownloadController(ports);
    await controller.startFromText(sourceUrl);

    await expect(controller.cancel('job-1')).resolves.toBeUndefined();

    expect(ports.background.cancel).toHaveBeenCalledWith('job-1');
    expect(ports.files.removeTemporary).toHaveBeenCalledWith('file:///tmp/clip.mp4');
    expect(controller.get('job-1')).toMatchObject({ status: 'cancelled' });
  });

  test('reconciles native completion exactly once after restart', async () => {
    const ports = createPorts({
      background: {
        enqueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue([
          { id: 'job-1', status: 'complete', fileUri: 'file:///tmp/clip.mp4' },
        ]),
      },
    });
    const controller = createDownloadController(ports);
    await controller.startFromText(sourceUrl);

    await controller.reconcile();
    await controller.reconcile();

    expect(ports.files.export).toHaveBeenCalledTimes(1);
    expect(ports.history.save).toHaveBeenCalledTimes(1);
    expect(ports.notifications.complete).toHaveBeenCalledTimes(1);
    expect(controller.get('job-1')).toMatchObject({ status: 'complete', assetUri: 'ph://clip' });
  });

  test('protects a native completion from concurrent reconciliation', async () => {
    let releaseExport!: (value: { assetUri: string }) => void;
    let markExportStarted!: () => void;
    const exportStarted = new Promise<void>((resolve) => {
      markExportStarted = resolve;
    });
    const exportResult = new Promise<{ assetUri: string }>((resolve) => {
      releaseExport = resolve;
    });
    const ports = createPorts({
      background: {
        enqueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue([
          { id: 'job-1', status: 'complete', fileUri: 'file:///tmp/clip.mp4' },
        ]),
      },
      files: createFiles({
        export: jest.fn().mockImplementation(() => {
          markExportStarted();
          return exportResult;
        }),
        removeTemporary: jest.fn().mockResolvedValue(undefined),
      }),
    });
    const controller = createDownloadController(ports);
    await controller.startFromText(sourceUrl);

    const first = controller.reconcile();
    await exportStarted;
    const second = controller.reconcile();
    releaseExport({ assetUri: 'ph://clip' });
    await Promise.all([first, second]);

    expect(ports.files.export).toHaveBeenCalledTimes(1);
    expect(ports.history.save).toHaveBeenCalledTimes(1);
    expect(controller.get('job-1')).toMatchObject({ status: 'complete' });
  });

  test('retries reconciliation after export failure and preserves the temporary file', async () => {
    const ports = createPorts({
      background: {
        enqueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue([
          { id: 'job-1', status: 'complete', fileUri: 'file:///tmp/clip.mp4' },
        ]),
      },
      files: createFiles({
        export: jest
          .fn()
          .mockRejectedValueOnce(new Error('media library busy'))
          .mockResolvedValueOnce({ assetUri: 'ph://clip' }),
        removeTemporary: jest.fn().mockResolvedValue(undefined),
      }),
    });
    const controller = createDownloadController(ports);
    await controller.startFromText(sourceUrl);

    await controller.reconcile();

    expect(controller.get('job-1')).toMatchObject({ status: 'exporting' });
    expect(ports.files.removeTemporary).not.toHaveBeenCalled();

    await controller.reconcile();

    expect(ports.files.export).toHaveBeenCalledTimes(2);
    expect(controller.get('job-1')).toMatchObject({ status: 'complete' });
  });

  test('publishes complete only after export and history, then treats notification and cleanup as best effort', async () => {
    const order: string[] = [];
    const ports = createPorts({
      background: {
        enqueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue([
          { id: 'job-1', status: 'complete', fileUri: 'file:///tmp/clip.mp4' },
        ]),
      },
      history: {
        findBySourceUrl: jest.fn().mockResolvedValue(null),
        findByJobId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async () => {
          order.push('history');
        }),
      },
      files: createFiles({
        export: jest.fn().mockImplementation(async () => {
          order.push('export');
          return { assetUri: 'ph://clip' };
        }),
        removeTemporary: jest.fn().mockImplementation(async () => {
          order.push('cleanup');
          throw new Error('cleanup denied');
        }),
      }),
      notifications: {
        complete: jest.fn().mockImplementation(async () => {
          order.push('notification');
          throw new Error('notifications denied');
        }),
      },
    });
    const controller = createDownloadController(ports, (job) => {
      if (job.status === 'complete') order.push('complete');
    });
    await controller.startFromText(sourceUrl);

    await expect(controller.reconcile()).resolves.toBeUndefined();

    expect(order).toEqual(['export', 'history', 'complete', 'notification', 'cleanup']);
    expect(controller.get('job-1')).toMatchObject({ status: 'complete' });
  });

  test('does not publish complete when history persistence fails and resumes without re-exporting', async () => {
    const ports = createPorts({
      background: {
        enqueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue([
          { id: 'job-1', status: 'complete', fileUri: 'file:///tmp/clip.mp4' },
        ]),
      },
      history: {
        findBySourceUrl: jest.fn().mockResolvedValue(null),
        findByJobId: jest.fn().mockResolvedValue(null),
        save: jest
          .fn()
          .mockRejectedValueOnce(new Error('database busy'))
          .mockResolvedValueOnce(undefined),
      },
    });
    const controller = createDownloadController(ports);
    await controller.startFromText(sourceUrl);

    await controller.reconcile();

    expect(controller.get('job-1')).toMatchObject({ status: 'exporting' });
    expect(ports.notifications.complete).not.toHaveBeenCalled();
    expect(ports.files.removeTemporary).not.toHaveBeenCalled();

    await controller.reconcile();

    expect(ports.files.export).toHaveBeenCalledTimes(1);
    expect(ports.history.save).toHaveBeenCalledTimes(2);
    expect(controller.get('job-1')).toMatchObject({ status: 'complete' });
  });
});
