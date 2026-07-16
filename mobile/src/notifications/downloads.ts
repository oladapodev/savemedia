import type { DownloadNotifications } from '../downloads/ports';

export type NotificationPermission = { granted: boolean; canAskAgain: boolean };
export type CompletionNotification = {
  title: string;
  body: string;
  data: { assetUri: string; jobId: string };
};

export interface NotificationNativeDependencies {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  ensureDownloadChannel(): Promise<void>;
  schedule(notification: CompletionNotification): Promise<string>;
}

export interface NotificationLifecycleDependencies {
  configureForegroundHandler(): void;
  addResponseListener(listener: (data: Record<string, unknown>) => void): () => void;
}

export function startDownloadNotificationLifecycle(
  native: NotificationLifecycleDependencies,
  openHistory: (jobId: string) => void,
): () => void {
  native.configureForegroundHandler();
  return native.addResponseListener((data) => {
    if (typeof data.jobId === 'string' && typeof data.assetUri === 'string') openHistory(data.jobId);
  });
}

export function createDownloadNotifications(native: NotificationNativeDependencies): DownloadNotifications {
  return {
    async complete(job) {
      try {
        await native.ensureDownloadChannel();
        let permission = await native.getPermission();
        if (!permission.granted && permission.canAskAgain) {
          permission = await native.requestPermission();
        }
        if (!permission.granted) return 'denied';

        await native.schedule({
          title: 'Download complete',
          body: `${job.transfer?.filename ?? 'Your media'} is saved to your device.`,
          data: { assetUri: job.assetUri, jobId: job.id },
        });
        return 'sent';
      } catch {
        return 'failed';
      }
    },
  };
}
