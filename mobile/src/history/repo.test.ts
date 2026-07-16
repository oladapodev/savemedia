import { FakeSqliteDatabase } from './test-db';
import type { DownloadJob } from '../downloads/types';
import {
  asDownloadHistoryRepo,
  DuplicateHistoryIdentityError,
  HistoryRepository,
  MissingDownloadJobError,
  type HistoryEntryInput,
} from './repo';
import { JobRepository } from './jobs';
import { CURRENT_SCHEMA_VERSION, migrateDatabase } from './schema';

const entry: HistoryEntryInput = {
  id: 'job-1',
  sourceUrl: 'https://instagram.com/reel/abc',
  mediaIdentity: 'instagram:abc',
  platform: 'instagram',
  thumbnailUrl: 'https://images.example/abc.jpg',
  filename: 'clip.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1024,
  status: 'saved',
  createdAt: 100,
  completedAt: 101,
  quality: 'balanced',
  deviceAssetRef: 'ph://clip',
  metadata: { source: 'download-controller' },
};

async function seedExportingJob(
  db: FakeSqliteDatabase,
  id = entry.id,
  sourceUrl = entry.sourceUrl,
): Promise<void> {
  await new JobRepository(db, () => 100).save({
    id,
    sourceUrl,
    status: 'exporting',
    selection: {
      itemId: 'item-1', quality: 'balanced',
      variant: { id: 'variant-1', mediaType: 'video', reliable: true },
    },
    temporaryUri: `file:///tmp/${id}.mp4`,
    assetUri: `ph://${id}`,
  });
}

describe('SQLite history migrations', () => {
  test('creates versioned jobs, history, and settings schema in an exclusive transaction', async () => {
    const db = new FakeSqliteDatabase();

    await migrateDatabase(db);

    expect(db.exclusiveTransactions).toBe(1);
    expect(db.executed.join('\n')).toContain('journal_mode = WAL');
    expect(db.executed.join('\n')).toContain('foreign_keys = ON');
    expect(db.executed.join('\n')).toContain('CREATE TABLE IF NOT EXISTS jobs');
    expect(db.executed.join('\n')).toContain('CREATE TABLE IF NOT EXISTS history');
    expect(db.executed.join('\n')).toContain('CREATE TABLE IF NOT EXISTS settings');
    expect(db.executed.join('\n')).toContain('media_identity TEXT NOT NULL UNIQUE');
    expect(db.userVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  test('upgrades an older schema version without replaying prior migrations', async () => {
    const db = new FakeSqliteDatabase();
    db.userVersion = 1;

    await migrateDatabase(db);

    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    expect(db.executed.join('\n')).toContain('jobs_status_idx');
    expect(db.executed.join('\n')).not.toContain('CREATE TABLE IF NOT EXISTS jobs');
    expect(db.userVersion).toBe(2);
  });

  test('is idempotent while reapplying connection pragmas', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const schemaWrites = db.executed.filter((sql) => sql.includes('CREATE TABLE')).length;

    await migrateDatabase(db);

    expect(db.executed.filter((sql) => sql.includes('CREATE TABLE'))).toHaveLength(schemaWrites);
    expect(db.executed.filter((sql) => sql === 'PRAGMA journal_mode = WAL;')).toHaveLength(2);
    expect(db.executed.filter((sql) => sql === 'PRAGMA foreign_keys = ON;')).toHaveLength(2);
    expect(db.exclusiveTransactions).toBe(2);
  });

  test('rolls back a failed version upgrade and leaves its version unchanged', async () => {
    const db = new FakeSqliteDatabase();
    db.userVersion = 1;
    db.failOnExecContaining = 'jobs_status_idx';

    await expect(migrateDatabase(db)).rejects.toThrow('forced exec failure');

    expect(db.userVersion).toBe(1);
    expect(db.transactionRollbacks).toBe(1);
  });
});

describe('HistoryRepository', () => {
  test('stores rich direct-share metadata and exposes fingerprint lookup through the controller adapter', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const sourceUrl = 'shared-media://job-local';
    await seedExportingJob(db, 'job-local', sourceUrl);
    const adapter = asDownloadHistoryRepo(new HistoryRepository(db));

    await adapter.save({
      jobId: 'job-local',
      sourceUrl,
      assetUri: 'ph://local-photo',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 4096,
      quality: 'original',
      platform: 'device',
      mediaIdentity: 'local:photo-sha256:4096',
      sourceKind: 'device-share',
      completedAt: 200,
    });

    await expect(adapter.findByMediaIdentity?.('local:photo-sha256:4096')).resolves.toEqual({
      jobId: 'job-local', sourceUrl,
    });
    await expect(new HistoryRepository(db).findByJobId('job-local')).resolves.toMatchObject({
      mediaIdentity: 'local:photo-sha256:4096',
      platform: 'device',
      metadata: {
        mediaType: 'image',
        sourceKind: 'device-share',
        fingerprint: 'local:photo-sha256:4096',
      },
    });
  });

  test('requires an existing controller-owned job instead of synthesizing completion', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);

    await expect(new HistoryRepository(db).save(entry)).rejects.toBeInstanceOf(MissingDownloadJobError);
    expect(db.jobs.size).toBe(0);
    expect(db.history.size).toBe(0);
  });

  test('inserts history without changing an exporting job during the finalization restart window', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const exporting: DownloadJob = {
      id: entry.id,
      sourceUrl: entry.sourceUrl,
      status: 'exporting',
      selection: {
        itemId: 'item-1', quality: 'balanced',
        variant: { id: 'variant-1', mediaType: 'video', reliable: true },
      },
      transfer: {
        downloadUrl: 'https://cdn.example/clip.mp4', filename: 'clip.mp4', mediaType: 'video',
        mimeType: 'video/mp4', quality: 'balanced', platform: 'instagram', mediaIdentity: 'instagram:abc',
      },
      temporaryUri: 'file:///tmp/clip.mp4',
      assetUri: 'ph://clip',
    };
    const jobs = new JobRepository(db, () => 100);
    await jobs.save(exporting);

    await new HistoryRepository(db).save(entry);

    await expect(jobs.get(entry.id)).resolves.toEqual(exporting);
    await expect(jobs.listActive()).resolves.toEqual([exporting]);
  });
  test('makes duplicate normalized media identities explicit', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const history = new HistoryRepository(db);
    await seedExportingJob(db);
    await seedExportingJob(db, 'job-2', 'https://instagram.com/reel/abc?utm=1');
    await history.save(entry);

    await expect(history.save({ ...entry, id: 'job-2', sourceUrl: 'https://instagram.com/reel/abc?utm=1' }))
      .rejects.toBeInstanceOf(DuplicateHistoryIdentityError);
  });

  test('preserves typed history when a repository is recreated over the same database', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    await seedExportingJob(db);
    await new HistoryRepository(db).save(entry);

    const restored = await new HistoryRepository(db).findByJobId('job-1');

    expect(restored).toEqual({ ...entry, metadataVersion: 1 });
  });

  test('rolls back the job upsert when history insertion fails', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    await seedExportingJob(db);
    db.failNextHistoryInsert = new Error('disk full');

    await expect(new HistoryRepository(db).save(entry)).rejects.toThrow('disk full');

    expect(db.jobs.size).toBe(1);
    expect(db.history.size).toBe(0);
    expect(db.transactionRollbacks).toBe(1);
  });

  test('serializes a duplicate race without leaving an orphan job', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const history = new HistoryRepository(db);
    await seedExportingJob(db);
    await seedExportingJob(db, 'job-2', `${entry.sourceUrl}?utm_source=share`);

    const results = await Promise.allSettled([
      history.save(entry),
      history.save({ ...entry, id: 'job-2', sourceUrl: `${entry.sourceUrl}?utm_source=share` }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(db.jobs.size).toBe(2);
    expect(db.history.size).toBe(1);
  });

  test('uses canonical media identities in the download-controller adapter', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const adapter = asDownloadHistoryRepo(new HistoryRepository(db));
    const record = {
      jobId: 'job-youtube-1',
      sourceUrl: 'https://youtube.com/watch?v=video-one&utm_source=share',
      assetUri: 'ph://one',
      filename: 'one.mp4',
      mediaType: 'video' as const,
      completedAt: 100,
    };
    await seedExportingJob(db, record.jobId, record.sourceUrl);
    await seedExportingJob(db, 'job-youtube-duplicate', 'https://youtu.be/video-one?si=tracking');
    await seedExportingJob(db, 'job-youtube-2', 'https://youtube.com/watch?v=video-two');
    await adapter.save(record);

    await expect(adapter.save({
      ...record,
      jobId: 'job-youtube-duplicate',
      sourceUrl: 'https://youtu.be/video-one?si=tracking',
    })).rejects.toBeInstanceOf(DuplicateHistoryIdentityError);
    await expect(adapter.save({
      ...record,
      jobId: 'job-youtube-2',
      sourceUrl: 'https://youtube.com/watch?v=video-two',
    })).resolves.toBeUndefined();
    expect([...db.history.values()].map((row) => row.media_identity)).toEqual([
      'youtube:video-one',
      'youtube:video-two',
    ]);
  });

  test('finds tracking variants through canonical identity before export', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const adapter = asDownloadHistoryRepo(new HistoryRepository(db));
    await seedExportingJob(db, 'job-youtube-existing', 'https://youtube.com/watch?v=existing-video&utm_source=share');
    await adapter.save({
      jobId: 'job-youtube-existing',
      sourceUrl: 'https://youtube.com/watch?v=existing-video&utm_source=share',
      assetUri: 'ph://existing',
      filename: 'existing.mp4',
      mediaType: 'video',
      completedAt: 100,
    });

    await expect(adapter.findBySourceUrl('https://youtu.be/existing-video?si=tracking')).resolves.toEqual({
      jobId: 'job-youtube-existing',
      sourceUrl: 'https://youtube.com/watch?v=existing-video&utm_source=share',
    });
  });

  test.each([
    ['https://youtu.be/video-one', 'youtube'],
    ['https://x.com/user/status/123', 'twitter'],
  ])('stores known platform metadata for alias URL %s', async (sourceUrl, platform) => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    await seedExportingJob(db, `job-${platform}`, sourceUrl);
    await asDownloadHistoryRepo(new HistoryRepository(db)).save({
      jobId: `job-${platform}`,
      sourceUrl,
      assetUri: `ph://${platform}`,
      filename: `${platform}.mp4`,
      mediaType: 'video',
      completedAt: 100,
    });

    expect([...db.history.values()][0]?.platform).toBe(platform);
  });

  test('atomically removes a history record and its paired job', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const history = new HistoryRepository(db);
    await seedExportingJob(db);
    await history.save(entry);

    await history.remove(entry.id);

    expect(db.history.size).toBe(0);
    expect(db.jobs.size).toBe(0);
  });

  test('rolls back history removal when paired job deletion fails', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const history = new HistoryRepository(db);
    await seedExportingJob(db);
    await history.save(entry);
    const rollbacksBeforeRemove = db.transactionRollbacks;
    db.failNextJobDelete = new Error('job delete failed');

    await expect(history.remove(entry.id)).rejects.toThrow('job delete failed');

    expect(db.history.size).toBe(1);
    expect(db.jobs.size).toBe(1);
    expect(db.transactionRollbacks).toBe(rollbacksBeforeRemove + 1);
  });

  test('leaves a controller-completed job terminal when history is saved', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    await new JobRepository(db, () => 100).save({
      id: entry.id,
      sourceUrl: entry.sourceUrl,
      status: 'complete',
      selection: {
        itemId: 'item-1', quality: 'balanced',
        variant: { id: 'variant-1', mediaType: 'video', reliable: true },
      },
      temporaryUri: 'file:///tmp/clip.mp4',
      assetUri: 'ph://clip',
    });
    await new HistoryRepository(db).save(entry);

    await expect(new JobRepository(db).listActive()).resolves.toEqual([]);
    await expect(new JobRepository(db).get(entry.id)).resolves.toMatchObject({
      id: entry.id,
      sourceUrl: entry.sourceUrl,
      status: 'complete',
      assetUri: entry.deviceAssetRef,
    });
  });

  test('preserves lossless JobRepository metadata when history finalizes the same job', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const selection = {
      itemId: 'item-1',
      quality: 'balanced' as const,
      variant: { id: 'variant-1', mediaType: 'video' as const, reliable: true },
    };
    const completeJob: DownloadJob = {
      id: entry.id,
      sourceUrl: entry.sourceUrl,
      status: 'complete',
      selection,
      temporaryUri: 'file:///tmp/clip.mp4',
      assetUri: 'ph://clip',
    };
    const jobs = new JobRepository(db, () => 100);
    await jobs.save(completeJob);

    await new HistoryRepository(db).save(entry);

    await expect(jobs.get(entry.id)).resolves.toEqual(completeJob);
  });
});
