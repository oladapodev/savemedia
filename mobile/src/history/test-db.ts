import type { SqliteDatabase, SqliteRunResult } from './schema';

type JobRow = { id: string; source_url: string; status: string; metadata_version: number; metadata_json: string; created_at: number; updated_at: number };
type HistoryRow = {
  id: string;
  job_id: string;
  source_url: string;
  media_identity: string;
  platform: string;
  thumbnail_url: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  status: string;
  created_at: number;
  completed_at: number | null;
  quality: string;
  device_asset_ref: string | null;
  metadata_version: number;
  metadata_json: string;
};
type SettingsRow = {
  singleton_id: number;
  quality: string;
  smart_auto_save: number;
  alerts: number;
  allow_cellular: number;
  theme_mode: string;
  metadata_version: number;
  metadata_json: string;
  updated_at: number;
};

/** A deterministic test double that implements only the production DB boundary. */
export class FakeSqliteDatabase implements SqliteDatabase {
  readonly executed: string[] = [];
  readonly jobs = new Map<string, JobRow>();
  readonly history = new Map<string, HistoryRow>();
  settings: SettingsRow | null = null;
  userVersion = 0;
  exclusiveTransactions = 0;
  transactionRollbacks = 0;
  failNextHistoryInsert: Error | null = null;
  failNextJobDelete: Error | null = null;
  failOnExecContaining: string | null = null;
  private transactionTail: Promise<void> = Promise.resolve();

  async execAsync(source: string): Promise<void> {
    this.executed.push(source);
    if (this.failOnExecContaining && source.includes(this.failOnExecContaining)) {
      throw new Error(`forced exec failure: ${this.failOnExecContaining}`);
    }
    const version = source.match(/PRAGMA user_version = (\d+)/i);
    if (version) this.userVersion = Number(version[1]);
  }

  async withExclusiveTransactionAsync(task: (transaction: SqliteDatabase) => Promise<void>): Promise<void> {
    const run = async () => {
      this.exclusiveTransactions += 1;
      const jobs = new Map(this.jobs);
      const history = new Map(this.history);
      const settings = this.settings ? { ...this.settings } : null;
      const userVersion = this.userVersion;
      try {
        await task(this);
      } catch (error) {
        this.jobs.clear();
        for (const [id, row] of jobs) this.jobs.set(id, row);
        this.history.clear();
        for (const [id, row] of history) this.history.set(id, row);
        this.settings = settings;
        this.userVersion = userVersion;
        this.transactionRollbacks += 1;
        throw error;
      }
    };
    const transaction = this.transactionTail.then(run, run);
    this.transactionTail = transaction.then(() => undefined, () => undefined);
    await transaction;
  }

  async runAsync(source: string, ...params: (string | number | null)[]): Promise<SqliteRunResult> {
    this.executed.push(source);
    if (source.includes('INSERT INTO jobs')) {
      const [id, sourceUrl, status, metadataVersion, metadataJson, createdAt, updatedAt] = params as [string, string, string, number, string, number, number];
      const existing = this.jobs.get(id);
      const preservesMatchingMetadata = source.includes('CASE WHEN jobs.status = excluded.status');
      this.jobs.set(id, {
        id,
        source_url: sourceUrl,
        status,
        metadata_version: preservesMatchingMetadata && existing?.status === status ? existing.metadata_version : metadataVersion,
        metadata_json: preservesMatchingMetadata && existing?.status === status ? existing.metadata_json : metadataJson,
        created_at: existing?.created_at ?? createdAt,
        updated_at: updatedAt,
      });
      return { changes: 1 };
    }
    if (source.includes('INSERT INTO history')) {
      if (this.failNextHistoryInsert) {
        const error = this.failNextHistoryInsert;
        this.failNextHistoryInsert = null;
        throw error;
      }
      const [id, jobId, sourceUrl, identity, platform, thumbnail, filename, mimeType, sizeBytes, status, createdAt, completedAt, quality, assetRef, metadataVersion, metadataJson] = params as [string, string, string, string, string, string | null, string, string, number | null, string, number, number | null, string, string | null, number, string];
      if ([...this.history.values()].some((row) => row.media_identity === identity)) throw new Error('UNIQUE constraint failed: history.media_identity');
      this.history.set(id, { id, job_id: jobId, source_url: sourceUrl, media_identity: identity, platform, thumbnail_url: thumbnail, filename, mime_type: mimeType, size_bytes: sizeBytes, status, created_at: createdAt, completed_at: completedAt, quality, device_asset_ref: assetRef, metadata_version: metadataVersion, metadata_json: metadataJson });
      return { changes: 1 };
    }
    if (source.includes('DELETE FROM history')) {
      const [id] = params as [string];
      return { changes: this.history.delete(id) ? 1 : 0 };
    }
    if (source.includes('DELETE FROM jobs')) {
      if (this.failNextJobDelete) {
        const error = this.failNextJobDelete;
        this.failNextJobDelete = null;
        throw error;
      }
      const [id] = params as [string];
      return { changes: this.jobs.delete(id) ? 1 : 0 };
    }
    if (source.includes('INSERT INTO settings')) {
      const [quality, smartAutoSave, alerts, allowCellular, themeMode, metadataVersion, metadataJson, updatedAt] = params as [string, number, number, number, string, number, string, number];
      this.settings = { singleton_id: 1, quality, smart_auto_save: smartAutoSave, alerts, allow_cellular: allowCellular, theme_mode: themeMode, metadata_version: metadataVersion, metadata_json: metadataJson, updated_at: updatedAt };
      return { changes: 1 };
    }
    throw new Error(`FakeSqliteDatabase does not support write: ${source}`);
  }

  async getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null> {
    this.executed.push(source);
    if (source.includes('PRAGMA user_version')) return { user_version: this.userVersion } as T;
    if (source.includes('FROM history WHERE media_identity')) return ([...this.history.values()].find((row) => row.media_identity === params[0]) ?? null) as T | null;
    if (source.includes('FROM history WHERE source_url')) return ([...this.history.values()].find((row) => row.source_url === params[0]) ?? null) as T | null;
    if (source.includes('FROM history WHERE job_id')) return ([...this.history.values()].find((row) => row.job_id === params[0]) ?? null) as T | null;
    if (source.includes('FROM jobs WHERE id')) return (this.jobs.get(String(params[0])) ?? null) as T | null;
    if (source.includes('FROM settings')) return this.settings as T | null;
    throw new Error(`FakeSqliteDatabase does not support read: ${source}`);
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    this.executed.push(source);
    if (source.includes('FROM history')) return [...this.history.values()] as T[];
    if (source.includes('FROM jobs')) {
      return [...this.jobs.values()].sort((left, right) => left.updated_at - right.updated_at) as T[];
    }
    throw new Error(`FakeSqliteDatabase does not support list: ${source}`);
  }
}
