export type NativeJobStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type NativeJobEvent = {
  id: string;
  status: NativeJobStatus;
  bytesWritten?: number;
  totalBytes?: number;
  filename?: string;
  mediaType?: 'audio' | 'image' | 'video';
  mimeType?: string;
  fileUri?: string;
  sizeBytes?: number;
  errorCode?: string;
};

export type NativeEnqueueInput = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
};

export type NativeSharedPayload = {
  value: string;
  shareType: 'text' | 'url' | 'image' | 'video';
  mimeType?: string;
  contentUri?: string | null;
  contentType?: 'text' | 'website' | 'image' | 'video' | null;
  contentMimeType?: string | null;
  originalName?: string | null;
  contentSize?: number | null;
};

export type NativeSharedBatch = {
  id: string;
  payloads: NativeSharedPayload[];
  errorCode?: string;
  errorMessage?: string;
};

export type NativeEventSubscription = { remove(): void };

export interface NativeDownloadsModule {
  enqueue(input: NativeEnqueueInput): Promise<void>;
  cancel(id: string): Promise<void>;
  list(): Promise<NativeJobEvent[]>;
  addListener(
    eventName: 'onDownloadEvent',
    listener: (event: NativeJobEvent) => void,
  ): NativeEventSubscription;
  addListener(
    eventName: 'onShareQueueChanged',
    listener: (event: { queued: boolean }) => void,
  ): NativeEventSubscription;
  listSharedPayloads(): Promise<NativeSharedBatch[]>;
  consumeSharedPayloads(id: string): Promise<void>;
}
