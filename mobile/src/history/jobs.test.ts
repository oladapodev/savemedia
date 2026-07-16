import type { DownloadJob } from '../downloads/types';
import { InvalidDownloadJobMetadataError, JobRepository } from './jobs';
import { migrateDatabase } from './schema';
import { FakeSqliteDatabase } from './test-db';

const selection = {
  itemId: 'item-1',
  quality: 'balanced' as const,
  variant: { id: 'variant-1', mediaType: 'video' as const, height: 1080, reliable: true, sizeBytes: 2048 },
};

const pausedJob: DownloadJob = {
  id: 'job-paused',
  sourceUrl: 'https://youtube.com/watch?v=restart-me',
  status: 'paused_offline',
  preview: {
    title: 'Restart me',
    items: [{ id: 'item-1', mediaType: 'video', variants: [selection.variant] }],
  },
  selection,
  temporaryUri: 'file:///tmp/restart.mp4',
  resumeStatus: 'downloading',
  resumeJob: {
    id: 'job-paused',
    sourceUrl: 'https://youtube.com/watch?v=restart-me',
    status: 'downloading',
    selection,
    temporaryUri: 'file:///tmp/restart.mp4',
  },
};

describe('JobRepository', () => {
  test('losslessly restores versioned active job metadata after repository recreation', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    await new JobRepository(db, () => 100).save(pausedJob);

    await expect(new JobRepository(db, () => 200).get(pausedJob.id)).resolves.toEqual(pausedJob);
    expect(db.jobs.get(pausedJob.id)).toMatchObject({
      status: 'paused_offline',
      metadata_version: 1,
      created_at: 100,
      updated_at: 100,
    });
  });

  test('lists only restartable jobs and removes jobs explicitly', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const jobs = new JobRepository(db, () => 100);
    const completeJob: DownloadJob = {
      id: 'job-complete',
      sourceUrl: 'https://youtube.com/watch?v=complete',
      status: 'complete',
      selection,
      temporaryUri: 'file:///tmp/complete.mp4',
      assetUri: 'ph://restart',
    };
    await jobs.save(pausedJob);
    await jobs.save(completeJob);

    await expect(jobs.listActive()).resolves.toEqual([pausedJob]);
    await jobs.remove(pausedJob.id);
    await expect(jobs.get(pausedJob.id)).resolves.toBeNull();
  });

  test('lists retryable failed jobs with recovery alongside active states after restart', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const jobs = new JobRepository(db, () => 100);
    const permissionFailure: DownloadJob = {
      id: 'job-permission',
      sourceUrl: 'https://youtube.com/watch?v=permission',
      status: 'failed',
      failure: { reason: 'permission', retryable: true },
      recovery: {
        selection,
        temporaryUri: 'file:///tmp/permission.mp4',
        transfer: {
          downloadUrl: 'https://cdn.example/permission.mp4', filename: 'permission.mp4',
          mediaType: 'video', mimeType: 'video/mp4', quality: 'balanced', platform: 'youtube',
          mediaIdentity: 'youtube:permission',
        },
      },
    };
    const terminalFailure: DownloadJob = {
      id: 'job-terminal', sourceUrl: 'https://example.com/nope', status: 'failed',
      failure: { reason: 'unsupported', retryable: false },
    };
    await jobs.save(pausedJob);
    await jobs.save(permissionFailure);
    await jobs.save(terminalFailure);

    await expect(new JobRepository(db).listActive()).resolves.toEqual([pausedJob, permissionFailure]);
  });

  test('rejects corrupt or unsupported persisted metadata', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    await new JobRepository(db, () => 100).save(pausedJob);
    const row = db.jobs.get(pausedJob.id)!;
    row.metadata_json = JSON.stringify({ version: 1, job: { id: pausedJob.id, status: 'downloading' } });

    await expect(new JobRepository(db).get(pausedJob.id)).rejects.toBeInstanceOf(InvalidDownloadJobMetadataError);

    row.metadata_version = 99;
    await expect(new JobRepository(db).get(pausedJob.id)).rejects.toBeInstanceOf(InvalidDownloadJobMetadataError);
  });

  test('validates optional nested recovery metadata instead of accepting malformed JSON shapes', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const queued: DownloadJob = { id: 'job-queued', sourceUrl: 'https://example.com/media', status: 'queued' };
    await new JobRepository(db, () => 100).save(queued);
    const row = db.jobs.get(queued.id)!;
    row.metadata_json = JSON.stringify({
      version: 1,
      job: { ...queued, preview: { items: 'not-an-array' } },
    });

    await expect(new JobRepository(db).get(queued.id)).rejects.toBeInstanceOf(InvalidDownloadJobMetadataError);
  });
});
