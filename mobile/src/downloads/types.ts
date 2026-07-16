export const DOWNLOAD_JOB_STATUSES = [
  'queued',
  'inspecting',
  'selection_required',
  'preparing',
  'downloading',
  'paused_offline',
  'exporting',
  'complete',
  'failed',
  'cancelled',
] as const;

export type DownloadJobStatus = (typeof DOWNLOAD_JOB_STATUSES)[number];

export const FAILURE_REASONS = [
  'unsupported',
  'private',
  'not_found',
  'offline',
  'provider',
  'storage',
  'permission',
  'invalid_file',
  'unknown',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export type DownloadFailure = {
  reason: FailureReason;
  retryable: boolean;
  message?: string;
};

export type MediaType = 'video' | 'audio' | 'image';

export const MAX_DIRECT_MEDIA_BYTES = 512 * 1024 * 1024;

export type DirectMediaInput = {
  sourceUri: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number;
  sourceOwnership?: 'expo-sharing-staging' | 'native-share-queue' | 'external';
};

export type DownloadProgress = {
  bytesWritten: number;
  totalBytes?: number;
};

export type MediaVariant = {
  id: string;
  mediaType: MediaType;
  height?: number;
  reliable: boolean;
  sizeBytes?: number;
  transfer?: DownloadTransferMetadata;
};

export type DownloadPreviewItem = {
  id: string;
  mediaType: MediaType;
  variants: readonly MediaVariant[];
};

export type DownloadPreview = {
  title?: string;
  items: readonly DownloadPreviewItem[];
};

export type DownloadSelection = {
  itemId: string;
  quality: 'balanced' | 'original' | 'audio';
  variant: MediaVariant;
};

export type DownloadTransferMetadata = {
  downloadUrl: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  sizeBytes?: number;
  quality?: 'balanced' | 'original' | 'audio';
  platform?: string;
  thumbnailUrl?: string;
  mediaIdentity?: string;
  sourceKind?: 'remote' | 'device-share';
};

export type DownloadRecoveryContext = {
  preview?: DownloadPreview;
  selection?: DownloadSelection;
  temporaryUri?: string;
  transfer?: DownloadTransferMetadata;
  assetUri?: string;
};

type JobBase = {
  id: string;
  sourceUrl: string;
  // Optional fields keep the union ergonomic for consumers that inspect a job
  // after a runtime status assertion; each active variant below tightens its
  // own required fields.
  preview?: DownloadPreview;
  selection?: DownloadSelection;
  temporaryUri?: string;
  transfer?: DownloadTransferMetadata;
  resumeStatus?: 'queued' | 'inspecting' | 'preparing' | 'downloading';
  resumeJob?: ResumableDownloadJob;
  assetUri?: string;
  failure?: DownloadFailure;
  progress?: DownloadProgress;
};

type QueuedDownloadJob = JobBase & { status: 'queued' };

type ResumableDownloadJob =
  | QueuedDownloadJob
  | (JobBase & { status: 'inspecting' })
  | (JobBase & { status: 'preparing'; selection: DownloadSelection })
  | (JobBase & {
      status: 'downloading';
      selection: DownloadSelection;
      temporaryUri: string;
    });

export type DownloadJob =
  | QueuedDownloadJob
  | (JobBase & { status: 'selection_required'; preview: DownloadPreview })
  | ResumableDownloadJob
  | (JobBase & {
      status: 'paused_offline';
      resumeStatus: 'queued' | 'inspecting' | 'preparing' | 'downloading';
      resumeJob: ResumableDownloadJob;
    })
  | (JobBase & {
      status: 'exporting';
      selection: DownloadSelection;
      temporaryUri: string;
      assetUri?: string;
    })
  | (JobBase & {
      status: 'complete';
      selection: DownloadSelection;
      temporaryUri: string;
      assetUri: string;
    })
  | (JobBase & {
      status: 'failed';
      failure: DownloadFailure;
      recovery?: DownloadRecoveryContext;
    })
  | (JobBase & { status: 'cancelled' });

export type DownloadJobEvent =
  | { type: 'INSPECTION_STARTED' }
  | { type: 'PREVIEW_READY'; preview: DownloadPreview }
  | { type: 'SELECTION_CONFIRMED'; selection: DownloadSelection }
  | { type: 'DOWNLOAD_STARTED'; temporaryUri: string; transfer?: DownloadTransferMetadata }
  | { type: 'DOWNLOAD_PROGRESS'; bytesWritten: number; totalBytes?: number }
  | { type: 'DOWNLOAD_SUCCEEDED'; temporaryUri: string }
  | { type: 'ASSET_EXPORTED'; assetUri: string }
  | { type: 'EXPORT_SUCCEEDED'; assetUri: string }
  | { type: 'OFFLINE' }
  | { type: 'ONLINE' }
  | { type: 'FAILED'; failure: DownloadFailure }
  | { type: 'RETRY' }
  | { type: 'CANCELLED' }
  // Deliberately unsupported: completion is only possible through EXPORT_SUCCEEDED.
  | { type: 'COMPLETE' };
