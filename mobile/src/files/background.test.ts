import { createActiveRuntimeDownloads, type ActiveTransferDependencies } from './background';

const input = {
  id: 'job-1',
  url: 'https://cdn.example/clip.mp4',
  filename: 'clip.mp4',
  mediaType: 'video' as const,
  mimeType: 'video/mp4',
  temporaryUri: 'file:///cache/clip.mp4',
};

test('active-runtime transfers expose completion metadata needed after reconciliation', async () => {
  let finish!: (value: { fileUri: string; sizeBytes: number }) => void;
  const transfer = new Promise<{ fileUri: string; sizeBytes: number }>((resolve) => {
    finish = resolve;
  });
  const native: ActiveTransferDependencies = {
    download: jest.fn().mockReturnValue(transfer),
  };
  const downloads = createActiveRuntimeDownloads(native);

  await downloads.enqueue(input);
  expect(await downloads.list()).toEqual([
    expect.objectContaining({ id: 'job-1', status: 'downloading', filename: 'clip.mp4', mediaType: 'video' }),
  ]);

  finish({ fileUri: input.temporaryUri, sizeBytes: 1024 });
  await Promise.resolve();
  await Promise.resolve();

  expect(await downloads.list()).toEqual([
    expect.objectContaining({
      id: 'job-1',
      status: 'complete',
      fileUri: input.temporaryUri,
      filename: 'clip.mp4',
      mediaType: 'video',
      sizeBytes: 1024,
    }),
  ]);
});

test('cancelling an active transfer aborts it and reports cancellation without an unhandled rejection', async () => {
  const native: ActiveTransferDependencies = {
    download: jest.fn().mockImplementation(async ({ signal }) => {
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
      return { fileUri: input.temporaryUri, sizeBytes: 1 };
    }),
  };
  const downloads = createActiveRuntimeDownloads(native);

  await downloads.enqueue(input);
  await downloads.cancel(input.id);
  await Promise.resolve();

  expect(await downloads.list()).toEqual([
    expect.objectContaining({ id: input.id, status: 'cancelled' }),
  ]);
});
