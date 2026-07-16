import {
  createDownloadNotifications,
  startDownloadNotificationLifecycle,
  type NotificationLifecycleDependencies,
  type NotificationNativeDependencies,
} from './downloads';

function createNative(overrides: Partial<NotificationNativeDependencies> = {}): NotificationNativeDependencies {
  return {
    getPermission: jest.fn().mockResolvedValue({ granted: true, canAskAgain: false }),
    requestPermission: jest.fn().mockResolvedValue({ granted: true, canAskAgain: false }),
    ensureDownloadChannel: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn().mockResolvedValue('notification-1'),
    ...overrides,
  };
}

const completed = {
  id: 'job-1',
  sourceUrl: 'https://example.com/video',
  status: 'complete' as const,
  selection: {
    itemId: 'item-1',
    quality: 'balanced' as const,
    variant: { id: 'variant-1', mediaType: 'video' as const, reliable: true },
  },
  transfer: {
    downloadUrl: 'https://cdn.example/video.mp4',
    filename: 'video.mp4',
    mediaType: 'video' as const,
    mimeType: 'video/mp4',
  },
  temporaryUri: 'file:///cache/video.mp4',
  assetUri: 'ph://video',
};

test('notification denial resolves as denied and never schedules an alert', async () => {
  const native = createNative({
    getPermission: jest.fn().mockResolvedValue({ granted: false, canAskAgain: false }),
  });

  await expect(createDownloadNotifications(native).complete(completed)).resolves.toBe('denied');
  expect(native.ensureDownloadChannel).toHaveBeenCalledTimes(1);
  expect(native.schedule).not.toHaveBeenCalled();
});

test('notification delivery failure resolves as failed so a saved job remains successful', async () => {
  const native = createNative({
    schedule: jest.fn().mockRejectedValue(new Error('notifications unavailable')),
  });

  await expect(createDownloadNotifications(native).complete(completed)).resolves.toBe('failed');
});

test('requests permission when allowed, creates the channel, and schedules local completion', async () => {
  const order: string[] = [];
  const native = createNative({
    getPermission: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
    ensureDownloadChannel: jest.fn().mockImplementation(async () => { order.push('channel'); }),
    requestPermission: jest.fn().mockImplementation(async () => {
      order.push('permission');
      return { granted: true, canAskAgain: false };
    }),
  });

  await expect(createDownloadNotifications(native).complete(completed)).resolves.toBe('sent');
  expect(native.requestPermission).toHaveBeenCalledTimes(1);
  expect(native.ensureDownloadChannel).toHaveBeenCalledTimes(1);
  expect(native.schedule).toHaveBeenCalledWith({
    title: 'Download complete',
    body: 'video.mp4 is saved to your device.',
    data: { assetUri: 'ph://video', jobId: 'job-1' },
  });
  expect(order).toEqual(['channel', 'permission']);
});

test('foreground lifecycle routes only download notification taps to History and disposes its listener', () => {
  let response!: (data: Record<string, unknown>) => void;
  const remove = jest.fn();
  const native: NotificationLifecycleDependencies = {
    configureForegroundHandler: jest.fn(),
    addResponseListener: jest.fn().mockImplementation((listener) => {
      response = listener;
      return remove;
    }),
  };
  const openHistory = jest.fn();

  const dispose = startDownloadNotificationLifecycle(native, openHistory);
  response({ jobId: 'job-1', assetUri: 'ph://one' });
  response({ unrelated: true });
  dispose();

  expect(native.configureForegroundHandler).toHaveBeenCalledTimes(1);
  expect(openHistory).toHaveBeenCalledWith('job-1');
  expect(openHistory).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});
