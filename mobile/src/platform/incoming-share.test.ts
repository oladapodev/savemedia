import type { NativeDownloadsModule } from './background';
import {
  createNativeIncomingShareSource,
  nativeShareQueueEnabled,
  nativeShareDedupeKey,
} from './incoming-share';

test('uses the bounded native share queue on both supported mobile platforms', () => {
  expect(nativeShareQueueEnabled('android')).toBe(true);
  expect(nativeShareQueueEnabled('ios')).toBe(true);
  expect(nativeShareQueueEnabled('web')).toBe(false);
});

function nativeModule(overrides: Partial<NativeDownloadsModule> = {}): NativeDownloadsModule {
  return {
    enqueue: jest.fn(),
    cancel: jest.fn(),
    list: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    listSharedPayloads: jest.fn().mockResolvedValue([]),
    consumeSharedPayloads: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test('reconstructs a bounded native share batch for the existing share normalizer and consumes it once', async () => {
  const native = nativeModule({
    listSharedPayloads: jest.fn().mockResolvedValue([{
      id: 'share-1',
      payloads: [{
        value: 'file:///cache/imediasave-shares/share-1-photo.jpg',
        shareType: 'image',
        mimeType: 'image/jpeg',
        contentUri: 'file:///cache/imediasave-shares/share-1-photo.jpg',
        contentType: 'image',
        contentMimeType: 'image/jpeg',
        originalName: 'photo.jpg',
        contentSize: 2048,
      }],
    }]),
  });
  const source = createNativeIncomingShareSource(native);

  const incoming = await source.read();

  expect(incoming).toMatchObject({
    sharedPayloads: [{ shareType: 'image', mimeType: 'image/jpeg' }],
    resolvedSharedPayloads: [{ contentSize: 2048, originalName: 'photo.jpg' }],
    isResolving: false,
    error: null,
    sourceOwnership: 'native-share-queue',
  });
  await incoming?.clearSharedPayloads();
  await incoming?.clearSharedPayloads();
  expect(native.consumeSharedPayloads).toHaveBeenCalledTimes(1);
  expect(native.consumeSharedPayloads).toHaveBeenCalledWith('share-1');
});

test('shares one in-flight native consume and retries after persistence failure', async () => {
  let release!: () => void;
  const consume = jest.fn()
    .mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }))
    .mockRejectedValueOnce(new Error('queue persistence failed'))
    .mockResolvedValueOnce(undefined);
  const native = nativeModule({
    listSharedPayloads: jest.fn().mockResolvedValue([{ id: 'share-1', payloads: [] }]),
    consumeSharedPayloads: consume,
  });
  const incoming = await createNativeIncomingShareSource(native).read();

  const first = incoming!.clearSharedPayloads();
  const second = incoming!.clearSharedPayloads();
  expect(consume).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, second]);

  (native.listSharedPayloads as jest.Mock).mockResolvedValue([{ id: 'share-2', payloads: [] }]);
  const failedBatch = await createNativeIncomingShareSource(native).read();
  await expect(failedBatch!.clearSharedPayloads()).rejects.toThrow('queue persistence failed');
  await expect(failedBatch!.clearSharedPayloads()).resolves.toBeUndefined();
  expect(consume).toHaveBeenCalledTimes(3);
});

test('surfaces a native pre-copy rejection without exposing a partially accepted payload', async () => {
  const native = nativeModule({
    listSharedPayloads: jest.fn().mockResolvedValue([{
      id: 'share-rejected',
      payloads: [],
      errorCode: 'too_large',
      errorMessage: 'Shared media exceeds the 512 MiB item limit.',
    }]),
  });

  const incoming = await createNativeIncomingShareSource(native).read();

  expect(incoming?.sharedPayloads).toEqual([]);
  expect(incoming?.resolvedSharedPayloads).toEqual([]);
  expect(incoming?.error).toEqual(expect.objectContaining({
    message: 'Shared media exceeds the 512 MiB item limit.',
  }));
  expect(incoming).toMatchObject({
    nativeBatchId: 'share-rejected',
    nativeErrorCode: 'too_large',
  });
});

test('dedupes navigation by durable batch id and error rather than an empty payload shape', () => {
  const first = {
    sharedPayloads: [], resolvedSharedPayloads: [], isResolving: false,
    error: new Error('rejected'), clearSharedPayloads: jest.fn(), refreshSharePayloads: jest.fn(),
    nativeBatchId: 'rejection-1', nativeErrorCode: 'too_large',
  };
  expect(nativeShareDedupeKey(first)).not.toBe(nativeShareDedupeKey({
    ...first,
    nativeBatchId: 'rejection-2',
  }));
});

test('invalidates the native share source when the durable queue changes', () => {
  const native = nativeModule();
  const source = createNativeIncomingShareSource(native);
  const listener = jest.fn();

  const unsubscribe = source.subscribe(listener);
  const nativeListener = (native.addListener as jest.Mock).mock.calls[0][1];
  nativeListener({ queued: true });

  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect((native.addListener as jest.Mock).mock.results[0].value.remove).toHaveBeenCalledTimes(1);
});
