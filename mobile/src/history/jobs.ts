import {
  DOWNLOAD_JOB_STATUSES,
  FAILURE_REASONS,
  type DownloadJob,
  type DownloadPreview,
  type DownloadSelection,
  type DownloadTransferMetadata,
  type MediaVariant,
} from '../downloads/types';
import type { SqliteDatabase } from './schema';

export const DOWNLOAD_JOB_METADATA_VERSION = 1;

type JobRow = {
  id: string;
  source_url: string;
  status: string;
  metadata_version: number;
  metadata_json: string;
  created_at: number;
  updated_at: number;
};

type JobEnvelope = { version: typeof DOWNLOAD_JOB_METADATA_VERSION; job: DownloadJob };

export function serializeDownloadJobMetadata(job: DownloadJob): string {
  const envelope: JobEnvelope = { version: DOWNLOAD_JOB_METADATA_VERSION, job };
  return JSON.stringify(envelope);
}

export class InvalidDownloadJobMetadataError extends Error {
  constructor(public readonly jobId: string) {
    super(`Persisted metadata for download job ${jobId} is invalid or unsupported.`);
    this.name = 'InvalidDownloadJobMetadataError';
  }
}

export class JobRepository {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  async save(job: DownloadJob): Promise<void> {
    const existing = await this.database.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', job.id);
    const timestamp = this.now();
    await this.database.runAsync(
      `INSERT INTO jobs (id, source_url, status, metadata_version, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, status = excluded.status,
         metadata_version = excluded.metadata_version, metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at`,
      job.id,
      job.sourceUrl,
      job.status,
      DOWNLOAD_JOB_METADATA_VERSION,
      serializeDownloadJobMetadata(job),
      existing?.created_at ?? timestamp,
      timestamp,
    );
  }

  async get(id: string): Promise<DownloadJob | null> {
    const row = await this.database.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', id);
    return row ? deserializeJob(row) : null;
  }

  async listActive(): Promise<DownloadJob[]> {
    const rows = await this.database.getAllAsync<JobRow>('SELECT * FROM jobs ORDER BY updated_at ASC');
    return rows.map(deserializeJob).filter((job) => (
      job.status !== 'complete'
      && job.status !== 'cancelled'
      && (job.status !== 'failed' || (job.failure.retryable && Boolean(job.recovery)))
    ));
  }

  async remove(id: string): Promise<void> {
    await this.database.runAsync('DELETE FROM jobs WHERE id = ?', id);
  }
}

function deserializeJob(row: JobRow): DownloadJob {
  if (row.metadata_version !== DOWNLOAD_JOB_METADATA_VERSION) throw new InvalidDownloadJobMetadataError(row.id);
  try {
    const parsed: unknown = JSON.parse(row.metadata_json);
    if (!isRecord(parsed) || parsed.version !== DOWNLOAD_JOB_METADATA_VERSION || !isDownloadJob(parsed.job)) {
      throw new InvalidDownloadJobMetadataError(row.id);
    }
    if (parsed.job.id !== row.id || parsed.job.sourceUrl !== row.source_url || parsed.job.status !== row.status) {
      throw new InvalidDownloadJobMetadataError(row.id);
    }
    return parsed.job;
  } catch (error) {
    if (error instanceof InvalidDownloadJobMetadataError) throw error;
    throw new InvalidDownloadJobMetadataError(row.id);
  }
}

function isDownloadJob(value: unknown): value is DownloadJob {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.sourceUrl !== 'string'
    || !DOWNLOAD_JOB_STATUSES.includes(value.status as DownloadJob['status'])) return false;
  if ((value.preview !== undefined && !isPreview(value.preview))
    || (value.selection !== undefined && !isSelection(value.selection))
    || (value.temporaryUri !== undefined && typeof value.temporaryUri !== 'string')
    || (value.transfer !== undefined && !isTransfer(value.transfer))
    || (value.assetUri !== undefined && typeof value.assetUri !== 'string')
    || (value.failure !== undefined && !isFailure(value.failure))
    || (value.resumeStatus !== undefined
      && value.resumeStatus !== 'queued'
      && value.resumeStatus !== 'inspecting'
      && value.resumeStatus !== 'preparing'
      && value.resumeStatus !== 'downloading')
    || (value.resumeJob !== undefined && !isResumableJob(value.resumeJob))) return false;

  switch (value.status) {
    case 'selection_required':
      return isPreview(value.preview);
    case 'preparing':
      return isSelection(value.selection);
    case 'downloading':
    case 'exporting':
      return isSelection(value.selection) && typeof value.temporaryUri === 'string';
    case 'paused_offline':
      return (value.resumeStatus === 'queued' || value.resumeStatus === 'inspecting' || value.resumeStatus === 'preparing' || value.resumeStatus === 'downloading')
        && isResumableJob(value.resumeJob);
    case 'complete':
      return isSelection(value.selection)
        && typeof value.temporaryUri === 'string'
        && typeof value.assetUri === 'string';
    case 'failed':
      return isFailure(value.failure) && (value.recovery === undefined || isRecovery(value.recovery));
    default:
      return true;
  }
}

function isResumableJob(value: unknown): boolean {
  return isDownloadJob(value)
    && (value.status === 'queued' || value.status === 'inspecting' || value.status === 'preparing' || value.status === 'downloading');
}

function isPreview(value: unknown): value is DownloadPreview {
  return isRecord(value)
    && (value.title === undefined || typeof value.title === 'string')
    && Array.isArray(value.items)
    && value.items.every((item) => isRecord(item)
      && typeof item.id === 'string'
      && isMediaType(item.mediaType)
      && Array.isArray(item.variants)
      && item.variants.every(isVariant));
}

function isSelection(value: unknown): value is DownloadSelection {
  return isRecord(value)
    && typeof value.itemId === 'string'
    && (value.quality === 'balanced' || value.quality === 'original' || value.quality === 'audio')
    && isVariant(value.variant);
}

function isVariant(value: unknown): value is MediaVariant {
  return isRecord(value)
    && typeof value.id === 'string'
    && isMediaType(value.mediaType)
    && typeof value.reliable === 'boolean'
    && (value.height === undefined || typeof value.height === 'number')
    && (value.sizeBytes === undefined || typeof value.sizeBytes === 'number')
    && (value.transfer === undefined || isTransfer(value.transfer));
}

function isFailure(value: unknown): boolean {
  return isRecord(value)
    && FAILURE_REASONS.includes(value.reason as (typeof FAILURE_REASONS)[number])
    && typeof value.retryable === 'boolean'
    && (value.message === undefined || typeof value.message === 'string');
}

function isTransfer(value: unknown): value is DownloadTransferMetadata {
  return isRecord(value)
    && typeof value.downloadUrl === 'string'
    && typeof value.filename === 'string'
    && isMediaType(value.mediaType)
    && typeof value.mimeType === 'string';
}

function isRecovery(value: unknown): boolean {
  return isRecord(value)
    && (value.preview === undefined || isPreview(value.preview))
    && (value.selection === undefined || isSelection(value.selection))
    && (value.temporaryUri === undefined || typeof value.temporaryUri === 'string')
    && (value.transfer === undefined || isTransfer(value.transfer))
    && (value.assetUri === undefined || typeof value.assetUri === 'string');
}

function isMediaType(value: unknown): value is MediaVariant['mediaType'] {
  return value === 'video' || value === 'audio' || value === 'image';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
