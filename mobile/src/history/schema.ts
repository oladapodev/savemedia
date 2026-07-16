/**
 * The deliberately small boundary shared by Expo SQLite production code and
 * deterministic repository tests. It mirrors the SDK 57 async query methods
 * used by this feature without leaking Expo/native objects into repositories.
 */
export type SqliteValue = string | number | null;

export type SqliteRunResult = { changes: number; lastInsertRowId?: number };

export interface SqliteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqliteValue[]): Promise<SqliteRunResult>;
  getFirstAsync<T>(source: string, ...params: SqliteValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SqliteValue[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (transaction: SqliteDatabase) => Promise<void>): Promise<void>;
}

export const CURRENT_SCHEMA_VERSION = 2;

const migrations: ReadonlyArray<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      source_url TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata_version INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      media_identity TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      thumbnail_url TEXT,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      quality TEXT NOT NULL,
      device_asset_ref TEXT,
      metadata_version INTEGER NOT NULL,
      metadata_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
      quality TEXT NOT NULL,
      smart_auto_save INTEGER NOT NULL CHECK (smart_auto_save IN (0, 1)),
      alerts INTEGER NOT NULL CHECK (alerts IN (0, 1)),
      allow_cellular INTEGER NOT NULL CHECK (allow_cellular IN (0, 1)),
      theme_mode TEXT NOT NULL,
      metadata_version INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS history_completed_at_idx ON history(completed_at DESC);
    CREATE INDEX IF NOT EXISTS history_source_url_idx ON history(source_url);
    `,
  },
  {
    version: 2,
    sql: `CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status, updated_at DESC);`,
  },
];

/** Applies every missing schema version atomically on the current SQLite connection. */
export async function migrateDatabase(database: SqliteDatabase): Promise<void> {
  // Both pragmas apply to the connection; table changes below remain exclusive.
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const version = await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const currentVersion = version?.user_version ?? 0;
    for (const migration of migrations) {
      if (migration.version <= currentVersion) continue;
      await transaction.execAsync(migration.sql);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version};`);
    }
  });
}
