import type { BackgroundDownloads, BackgroundEnqueueInput } from '../downloads/ports';
import {
  createPlatformBackgroundDownloads,
  type NativeDownloadsModule,
} from './background';

const input: BackgroundEnqueueInput = {
  id: 'job-native',
  url: 'https://cdn.example/clip.mp4',
  filename: 'clip.mp4',
  mediaType: 'video',
  mimeType: 'video/mp4',
  temporaryUri: 'file:///cache/controller-owned.mp4',
  quality: 'balanced',
  platform: 'instagram',
};

function nativeModule(): NativeDownloadsModule {
  return {
    enqueue: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([{
      id: input.id,
      status: 'paused',
      filename: input.filename,
      mediaType: input.mediaType,
      mimeType: input.mimeType,
      fileUri: 'file:///cache/imediasave-downloads/job-native-clip.mp4',
      sizeBytes: 4096,
      bytesWritten: 2048,
      totalBytes: 4096,
    }]),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    listSharedPayloads: jest.fn().mockResolvedValue([]),
    consumeSharedPayloads: jest.fn().mockResolvedValue(undefined),
  };
}

test('adapts the stable native contract without leaking controller-only paths or metadata', async () => {
  const native = nativeModule();
  const fallback = {} as BackgroundDownloads;
  const downloads = createPlatformBackgroundDownloads(native, fallback);

  await downloads.enqueue(input);

  expect(native.enqueue).toHaveBeenCalledWith({
    id: input.id,
    url: input.url,
    filename: input.filename,
    mimeType: input.mimeType,
  });
  await expect(downloads.list()).resolves.toEqual([expect.objectContaining({
    id: input.id,
    status: 'paused',
    filename: input.filename,
    mediaType: input.mediaType,
    mimeType: input.mimeType,
    fileUri: 'file:///cache/imediasave-downloads/job-native-clip.mp4',
    sizeBytes: 4096,
  })]);
});

test('bridges native events to the existing invalidation subscription and removes listeners', () => {
  const native = nativeModule();
  const downloads = createPlatformBackgroundDownloads(native, {} as BackgroundDownloads);
  const listener = jest.fn();

  const unsubscribe = downloads.subscribe?.(listener);
  const nativeListener = (native.addListener as jest.Mock).mock.calls[0][1];
  nativeListener({ id: input.id, status: 'downloading' });

  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe?.();
  expect((native.addListener as jest.Mock).mock.results[0].value.remove).toHaveBeenCalledTimes(1);
});

test('uses the optional active-runtime fallback when the local module is absent in Expo Go or tests', () => {
  const fallback = { enqueue: jest.fn() } as unknown as BackgroundDownloads;
  expect(createPlatformBackgroundDownloads(null, fallback)).toBe(fallback);
});

test('rejects a wildcard or mismatched MIME before invoking native enqueue', async () => {
  const native = nativeModule();
  const downloads = createPlatformBackgroundDownloads(native, {} as BackgroundDownloads);

  await expect(downloads.enqueue({ ...input, mimeType: 'video/*' })).rejects.toThrow('unsupported_mime');
  await expect(downloads.enqueue({ ...input, mimeType: 'audio/mpeg' })).rejects.toThrow('mime_mismatch');
  expect(native.enqueue).not.toHaveBeenCalled();
});
