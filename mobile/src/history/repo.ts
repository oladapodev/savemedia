import type { HistoryRecord as DownloadHistoryRecord, HistoryRepo as DownloadHistoryRepo } from '../downloads/ports';
import type { MediaType } from '../downloads/types';
import { mediaIdentityFromUrl } from '../share/identity';
import { detectKnownPlatform } from '../share/url';
import type { SqliteDatabase } from './schema';

export type HistoryStatus = 'saved' | 'failed' | 'pending';
export type HistoryQuality = 'balanced' | 'original' | 'audio';
export type HistoryMetadata = Record<string, unknown>;

export type HistoryEntry = {
  id: string; sourceUrl: string; mediaIdentity: string; platform: string; thumbnailUrl: string | null;
  filename: string; mimeType: string; sizeBytes: number | null; status: HistoryStatus;
  createdAt: number; completedAt: number | null; quality: HistoryQuality; deviceAssetRef: string | null;
  metadataVersion: number; metadata: HistoryMetadata;
};

export type HistoryEntryInput = Omit<HistoryEntry, 'metadataVersion'> & { metadataVersion?: number };

type HistoryRow = {
  id: string; job_id: string; source_url: string; media_identity: string; platform: string;
  thumbnail_url: string | null; filename: string; mime_type: string; size_bytes: number | null;
  status: HistoryStatus; created_at: number; completed_at: number | null; quality: HistoryQuality;
  device_asset_ref: string | null; metadata_version: number; metadata_json: string;
};

export class DuplicateHistoryIdentityError extends Error {
  constructor(public readonly mediaIdentity: string) {
    super(`History already contains media identity ${mediaIdentity}.`);
    this.name = 'DuplicateHistoryIdentityError';
  }
}

export class MissingDownloadJobError extends Error {
  constructor(public readonly jobId: string) {
    super(`Download job ${jobId} must exist before history can be saved.`);
    this.name = 'MissingDownloadJobError';
  }
}

export class HistoryRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async save(input: HistoryEntryInput): Promise<void> {
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        const job = await transaction.getFirstAsync<{ id: string }>('SELECT * FROM jobs WHERE id = ?', input.id);
        if (!job) throw new MissingDownloadJobError(input.id);
        const duplicate = await findOne(transaction, 'SELECT * FROM history WHERE media_identity = ?', input.mediaIdentity);
        if (duplicate && duplicate.id !== input.id) throw new DuplicateHistoryIdentityError(input.mediaIdentity);
        const metadataVersion = input.metadataVersion ?? 1;
        const metadataJson = JSON.stringify(input.metadata);
        await transaction.runAsync(
          `INSERT INTO history (
            id, job_id, source_url, media_identity, platform, thumbnail_url, filename, mime_type,
            size_bytes, status, created_at, completed_at, quality, device_asset_ref,
            metadata_version, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          input.id, input.id, input.sourceUrl, input.mediaIdentity, input.platform, input.thumbnailUrl,
          input.filename, input.mimeType, input.sizeBytes, input.status, input.createdAt, input.completedAt,
          input.quality, input.deviceAssetRef, metadataVersion, metadataJson,
        );
      });
    } catch (error) {
      if (error instanceof DuplicateHistoryIdentityError || error instanceof MissingDownloadJobError) throw error;
      if (isUniqueIdentityError(error)) throw new DuplicateHistoryIdentityError(input.mediaIdentity);
      throw error;
    }
  }

  async findByIdentity(mediaIdentity: string): Promise<HistoryEntry | null> {
    return this.findOne('SELECT * FROM history WHERE media_identity = ?', mediaIdentity);
  }

  async findBySourceUrl(sourceUrl: string): Promise<HistoryEntry | null> {
    return this.findOne('SELECT * FROM history WHERE source_url = ?', sourceUrl);
  }

  async findByJobId(jobId: string): Promise<HistoryEntry | null> {
    return this.findOne('SELECT * FROM history WHERE job_id = ?', jobId);
  }

  async list(): Promise<HistoryEntry[]> {
    const rows = await this.database.getAllAsync<HistoryRow>('SELECT * FROM history ORDER BY completed_at DESC, created_at DESC');
    return rows.map(rowToEntry);
  }

  async remove(id: string): Promise<void> {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM history WHERE id = ?', id);
      await transaction.runAsync('DELETE FROM jobs WHERE id = ?', id);
    });
  }

  private async findOne(query: string, value: string): Promise<HistoryEntry | null> {
    return findOne(this.database, query, value);
  }
}

/** Adapts the richer SQLite history entity to the download controller's narrow port. */
export function asDownloadHistoryRepo(history: HistoryRepository): DownloadHistoryRepo {
  return {
    async findBySourceUrl(sourceUrl) {
      const entry = await history.findByIdentity(mediaIdentityFromUrl(sourceUrl));
      return entry ? { jobId: entry.id, sourceUrl: entry.sourceUrl } : null;
    },
    async findByMediaIdentity(mediaIdentity) {
      const entry = await history.findByIdentity(mediaIdentity);
      return entry ? { jobId: entry.id, sourceUrl: entry.sourceUrl } : null;
    },
    async findByJobId(jobId) {
      const entry = await history.findByJobId(jobId);
      return entry ? toDownloadHistoryRecord(entry) : null;
    },
    async save(record) {
      await history.save({
        id: record.jobId, sourceUrl: record.sourceUrl,
        mediaIdentity: record.mediaIdentity ?? mediaIdentityFromUrl(record.sourceUrl),
        platform: record.platform ?? platformFromUrl(record.sourceUrl),
        thumbnailUrl: record.thumbnailUrl ?? null, filename: record.filename,
        mimeType: record.mimeType ?? mimeTypeForMedia(record.mediaType), sizeBytes: record.sizeBytes ?? null, status: 'saved',
        createdAt: record.completedAt, completedAt: record.completedAt, quality: record.quality ?? 'balanced',
        deviceAssetRef: record.assetUri,
        metadata: {
          mediaType: record.mediaType,
          ...(record.sourceKind ? { sourceKind: record.sourceKind } : {}),
          ...(record.sourceKind === 'device-share' && record.mediaIdentity
            ? { fingerprint: record.mediaIdentity }
            : {}),
        },
      });
    },
  };
}

function rowToEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id, sourceUrl: row.source_url, mediaIdentity: row.media_identity, platform: row.platform,
    thumbnailUrl: row.thumbnail_url, filename: row.filename, mimeType: row.mime_type, sizeBytes: row.size_bytes,
    status: row.status, createdAt: row.created_at, completedAt: row.completed_at, quality: row.quality,
    deviceAssetRef: row.device_asset_ref, metadataVersion: row.metadata_version, metadata: parseMetadata(row.metadata_json),
  };
}

function toDownloadHistoryRecord(entry: HistoryEntry): DownloadHistoryRecord {
  return {
    jobId: entry.id, sourceUrl: entry.sourceUrl, assetUri: entry.deviceAssetRef ?? '', filename: entry.filename,
    mediaType: (entry.metadata.mediaType as MediaType | undefined) ?? 'video', mimeType: entry.mimeType,
    ...(entry.sizeBytes === null ? {} : { sizeBytes: entry.sizeBytes }), quality: entry.quality,
    platform: entry.platform, ...(entry.thumbnailUrl ? { thumbnailUrl: entry.thumbnailUrl } : {}),
    mediaIdentity: entry.mediaIdentity, completedAt: entry.completedAt ?? entry.createdAt,
  };
}

async function findOne(database: SqliteDatabase, query: string, value: string): Promise<HistoryEntry | null> {
  const row = await database.getFirstAsync<HistoryRow>(query, value);
  return row ? rowToEntry(row) : null;
}

function platformFromUrl(sourceUrl: string): string {
  const knownPlatform = detectKnownPlatform(sourceUrl);
  if (knownPlatform) return knownPlatform;
  try { return new URL(sourceUrl).hostname.replace(/^www\./, '').split('.')[0] || 'unknown'; } catch { return 'unknown'; }
}

function mimeTypeForMedia(mediaType: MediaType): string {
  if (mediaType === 'audio') return 'audio/mpeg';
  if (mediaType === 'image') return 'image/*';
  return 'video/mp4';
}

function parseMetadata(value: string): HistoryMetadata {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as HistoryMetadata : {};
  } catch { return {}; }
}

function isUniqueIdentityError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed: history\.media_identity/i.test(error.message);
}
