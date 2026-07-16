import type { MediaApi } from '../api/types';
import type { DownloadJob, DownloadTransferMetadata, MediaType } from './types';

export type HistoryRecord = {
  jobId: string;
  sourceUrl: string;
  assetUri: string;
  filename: string;
  mediaType: MediaType;
  mimeType?: string;
  sizeBytes?: number;
  quality?: 'balanced' | 'original' | 'audio';
  platform?: string;
  thumbnailUrl?: string;
  mediaIdentity?: string;
  sourceKind?: 'remote' | 'device-share';
  completedAt: number;
};

export interface HistoryRepo {
  findBySourceUrl(sourceUrl: string): Promise<Pick<HistoryRecord, 'jobId' | 'sourceUrl'> | null>;
  findByMediaIdentity?(mediaIdentity: string): Promise<Pick<HistoryRecord, 'jobId' | 'sourceUrl'> | null>;
  findByJobId(jobId: string): Promise<HistoryRecord | null>;
  save(record: HistoryRecord): Promise<void>;
}

export type BackgroundEvent = {
  id: string;
  status: 'queued' | 'downloading' | 'paused' | 'complete' | 'failed' | 'cancelled';
  fileUri?: string;
  filename?: string;
  mediaType?: MediaType;
  mimeType?: string;
  sizeBytes?: number;
  bytesWritten?: number;
  totalBytes?: number;
  errorCode?: string;
};

export type BackgroundEnqueueInput = Omit<DownloadTransferMetadata, 'downloadUrl'> & {
  id: string;
  url: string;
  temporaryUri: string;
};

export interface BackgroundDownloads {
  enqueue(input: BackgroundEnqueueInput): Promise<void>;
  cancel(id: string): Promise<void>;
  list(): Promise<readonly BackgroundEvent[]>;
  subscribe?(listener: () => void): () => void;
}

export interface MediaFiles {
  temporaryUri(input: { id: string; filename: string }): string;
  importIncoming?(input: {
    sourceUri: string;
    temporaryUri: string;
    filename: string;
    mediaType: MediaType;
    mimeType: string;
    declaredSizeBytes: number;
    maxBytes: number;
    sourceOwnership?: 'expo-sharing-staging' | 'native-share-queue' | 'external';
  }): Promise<{ temporaryUri: string; sizeBytes: number; fingerprint: string }>;
  export(temporaryUri: string, input: { filename: string; mediaType: MediaType }): Promise<{ assetUri: string }>;
  removeTemporary(temporaryUri: string): Promise<void>;
  cleanupTemporary(preserveUris?: readonly string[]): Promise<{ removed: string[]; failed: Array<{ uri: string; message: string }> }>;
  cleanupIncomingStaging?(uris: readonly string[]): Promise<void>;
  requestMediaPermission(): Promise<'granted' | 'denied'>;
  deleteAsset(assetUri: string): Promise<void>;
  shareAsset(assetUri: string): Promise<void>;
  openAsset(assetUri: string): Promise<void>;
}

export interface DownloadNotifications {
  complete(job: Extract<DownloadJob, { status: 'complete' }>): Promise<'sent' | 'denied' | 'failed'>;
}

export type NetworkState = { online: boolean };

export interface NetworkStatus {
  getCurrent(): Promise<NetworkState>;
  subscribe(listener: (state: NetworkState) => void): () => void;
}

export interface JobStore {
  save(job: DownloadJob): Promise<void>;
  listActive(): Promise<DownloadJob[]>;
}

export interface DownloadPorts {
  api: MediaApi;
  history: HistoryRepo;
  jobs: JobStore;
  background: BackgroundDownloads;
  files: MediaFiles;
  notifications: DownloadNotifications;
  network?: NetworkStatus;
  now(): number;
  id(): string;
}
