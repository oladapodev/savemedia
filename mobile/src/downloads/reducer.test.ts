import { reduceJob } from './reducer';
import { downloadProgressPercent } from './progress';
import {
  DOWNLOAD_JOB_STATUSES,
  FAILURE_REASONS,
  type DownloadJob,
  type DownloadPreview,
  type MediaVariant,
} from './types';

const quality1080: MediaVariant = {
  id: 'video-1080',
  mediaType: 'video',
  height: 1080,
  reliable: true,
};

const oneVideo: DownloadPreview = {
  title: 'A video',
  items: [
    {
      id: 'video-1',
      mediaType: 'video',
      variants: [quality1080],
    },
  ],
};

const carousel: DownloadPreview = {
  title: 'A carousel',
  items: [
    { id: 'slide-1', mediaType: 'video', variants: [quality1080] },
    { id: 'slide-2', mediaType: 'image', variants: [] },
  ],
};

const inspectingJob: DownloadJob = {
  id: 'job-1',
  sourceUrl: 'https://example.com/media/1',
  status: 'inspecting',
};

const selectedJob = reduceJob(inspectingJob, {
  type: 'PREVIEW_READY',
  preview: oneVideo,
});

if (selectedJob.status !== 'preparing') {
  throw new Error('test fixture must produce a preparing job');
}

const downloadingJob = reduceJob(selectedJob, {
  type: 'DOWNLOAD_STARTED',
  temporaryUri: 'file:///tmp/job-1.mp4',
});

if (downloadingJob.status !== 'downloading') {
  throw new Error('test fixture must produce a downloading job');
}

describe('download job domain', () => {
  test('persists bounded byte progress on an active download and derives a Home percentage', () => {
    const progressed = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_PROGRESS', bytesWritten: 25, totalBytes: 100,
    });

    expect(progressed).toMatchObject({
      status: 'downloading',
      progress: { bytesWritten: 25, totalBytes: 100 },
    });
    expect(downloadProgressPercent(progressed.progress)).toBe(25);
  });
  test('publishes the exact stable statuses and failure reasons', () => {
    expect(DOWNLOAD_JOB_STATUSES).toEqual([
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
    ]);
    expect(FAILURE_REASONS).toEqual([
      'unsupported',
      'private',
      'not_found',
      'offline',
      'provider',
      'storage',
      'permission',
      'invalid_file',
      'unknown',
    ]);
  });

  test('starts inspection for a queued job', () => {
    const queued: DownloadJob = {
      id: 'job-1',
      sourceUrl: 'https://example.com/media/1',
      status: 'queued',
    };

    expect(reduceJob(queued, { type: 'INSPECTION_STARTED' })).toEqual({
      ...queued,
      status: 'inspecting',
    });
  });

  test('pauses a queued job offline and returns it to queued when online', () => {
    const queued: DownloadJob = {
      id: 'job-queued',
      sourceUrl: 'https://example.com/media/queued',
      status: 'queued',
    };

    const paused = reduceJob(queued, { type: 'OFFLINE' });

    expect(paused.status).toBe('paused_offline');
    expect(paused.resumeStatus).toBe('queued');
    expect(reduceJob(paused, { type: 'ONLINE' })).toEqual(queued);
  });

  test('moves an unambiguous video preview to balanced preparation', () => {
    const next = reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: oneVideo,
    });

    expect(next.status).toBe('preparing');
    expect(next.selection).toEqual({
      itemId: 'video-1',
      quality: 'balanced',
      variant: quality1080,
    });
  });

  test('requires selection for a multi-item result', () => {
    const next = reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: carousel,
    });

    expect(next.status).toBe('selection_required');
    expect(next.preview).toBe(carousel);
  });

  test('auto-selects one unambiguous audio item with audio quality', () => {
    const audioPreview: DownloadPreview = {
      items: [
        {
          id: 'audio-1',
          mediaType: 'audio',
          variants: [
            { id: 'audio', mediaType: 'audio', reliable: true },
          ],
        },
      ],
    };

    expect(reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: audioPreview,
    })).toMatchObject({
      status: 'preparing',
      selection: {
        itemId: 'audio-1',
        quality: 'audio',
        variant: { id: 'audio' },
      },
    });
  });

  test('auto-selects one unambiguous image item at original quality', () => {
    const imagePreview: DownloadPreview = {
      items: [
        {
          id: 'image-1',
          mediaType: 'image',
          variants: [{ id: 'original', mediaType: 'image', reliable: true }],
        },
      ],
    };

    expect(reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: imagePreview,
    })).toMatchObject({
      status: 'preparing',
      selection: {
        itemId: 'image-1',
        quality: 'original',
        variant: { id: 'original' },
      },
    });
  });

  test('prepares an explicitly selected item and variant', () => {
    const selectionRequired = reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: carousel,
    });
    const next = reduceJob(selectionRequired, {
      type: 'SELECTION_CONFIRMED',
      selection: {
        itemId: 'slide-1',
        quality: 'balanced',
        variant: quality1080,
      },
    });

    expect(next.status).toBe('preparing');
    expect(next.selection?.itemId).toBe('slide-1');
  });

  test('pauses an active download offline and resumes the same phase', () => {
    const paused = reduceJob(downloadingJob, { type: 'OFFLINE' });

    expect(paused.status).toBe('paused_offline');
    expect(paused.resumeStatus).toBe('downloading');
    expect(reduceJob(paused, { type: 'ONLINE' })).toEqual(downloadingJob);
  });

  test('pauses preparation offline and resumes preparation', () => {
    const paused = reduceJob(selectedJob, { type: 'OFFLINE' });

    expect(paused.status).toBe('paused_offline');
    expect(paused.resumeStatus).toBe('preparing');
    expect(reduceJob(paused, { type: 'ONLINE' })).toEqual(selectedJob);
  });

  test('moves a downloaded file to exporting without completing it', () => {
    const next = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1.mp4',
    });

    expect(next.status).toBe('exporting');
    expect(next.temporaryUri).toBe('file:///tmp/job-1.mp4');
  });

  test('never marks a job complete before export succeeds', () => {
    expect(() =>
      reduceJob(downloadingJob, { type: 'COMPLETE' }),
    ).toThrow(/illegal transition/i);

    const exporting = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1.mp4',
    });
    expect(() => reduceJob(exporting, { type: 'COMPLETE' })).toThrow(
      /illegal transition/i,
    );
  });

  test('completes only after export succeeds', () => {
    const exporting = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1.mp4',
    });
    const complete = reduceJob(exporting, {
      type: 'EXPORT_SUCCEEDED',
      assetUri: 'ph://saved-asset',
    });

    expect(complete.status).toBe('complete');
    expect(complete.assetUri).toBe('ph://saved-asset');
  });

  test.each([
    'unsupported',
    'private',
    'not_found',
    'offline',
    'provider',
    'storage',
    'permission',
    'invalid_file',
    'unknown',
  ] as const)('records the typed %s failure reason', (reason) => {
    const failed = reduceJob(downloadingJob, {
      type: 'FAILED',
      failure: {
        reason,
        retryable: reason === 'offline' || reason === 'provider',
        message: `Failure: ${reason}`,
      },
    });

    expect(failed.status).toBe('failed');
    expect(failed.failure.reason).toBe(reason);
    expect(failed.failure.retryable).toBe(
      reason === 'offline' || reason === 'provider',
    );
  });

  test('retries a failed job by returning it to queued', () => {
    const failed = reduceJob(downloadingJob, {
      type: 'FAILED',
      failure: { reason: 'provider', retryable: true },
    });

    expect(reduceJob(failed, { type: 'RETRY' })).toEqual({
      id: downloadingJob.id,
      sourceUrl: downloadingJob.sourceUrl,
      status: 'queued',
    });
  });

  test('rejects retry when the failure is not retryable', () => {
    const failed = reduceJob(downloadingJob, {
      type: 'FAILED',
      failure: { reason: 'permission', retryable: false },
    });

    expect(() => reduceJob(failed, { type: 'RETRY' })).toThrow(
      /illegal transition/i,
    );
  });

  test('preserves recovery context when each active state fails', () => {
    const queued: DownloadJob = {
      id: 'job-queued',
      sourceUrl: 'https://example.com/media/queued',
      status: 'queued',
    };
    const selectionRequired = reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: carousel,
    });
    const pausedDownloading = reduceJob(downloadingJob, { type: 'OFFLINE' });
    const exporting = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1-complete.mp4',
    });
    const cases: Array<{
      name: string;
      job: DownloadJob;
      recovery: unknown;
    }> = [
      { name: 'queued', job: queued, recovery: undefined },
      { name: 'inspecting', job: inspectingJob, recovery: undefined },
      {
        name: 'selection_required',
        job: selectionRequired,
        recovery: { preview: carousel },
      },
      {
        name: 'preparing',
        job: selectedJob,
        recovery: { selection: selectedJob.selection },
      },
      {
        name: 'downloading',
        job: downloadingJob,
        recovery: {
          selection: downloadingJob.selection,
          temporaryUri: downloadingJob.temporaryUri,
        },
      },
      {
        name: 'paused_offline',
        job: pausedDownloading,
        recovery: {
          selection: downloadingJob.selection,
          temporaryUri: downloadingJob.temporaryUri,
        },
      },
      {
        name: 'exporting',
        job: exporting,
        recovery: {
          selection: exporting.selection,
          temporaryUri: 'file:///tmp/job-1-complete.mp4',
        },
      },
    ];

    for (const { name, job, recovery } of cases) {
      const failed = reduceJob(job, {
        type: 'FAILED',
        failure: { reason: 'storage', retryable: true, message: name },
      });

      expect(failed.status).toBe('failed');
      expect(failed.failure).toEqual({
        reason: 'storage',
        retryable: true,
        message: name,
      });
      expect(failed.recovery).toEqual(recovery);
    }
  });

  test('rejects retry from every non-failed status', () => {
    const selectionRequired = reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: carousel,
    });
    const paused = reduceJob(downloadingJob, { type: 'OFFLINE' });
    const exporting = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1.mp4',
    });
    const complete = reduceJob(exporting, {
      type: 'EXPORT_SUCCEEDED',
      assetUri: 'ph://saved-asset',
    });
    const nonFailedJobs: DownloadJob[] = [
      { ...inspectingJob, status: 'queued' },
      inspectingJob,
      selectionRequired,
      selectedJob,
      downloadingJob,
      paused,
      exporting,
      complete,
      reduceJob(downloadingJob, { type: 'CANCELLED' }),
    ];

    for (const job of nonFailedJobs) {
      expect(() => reduceJob(job, { type: 'RETRY' })).toThrow(
        /illegal transition/i,
      );
    }
  });

  test('rejects offline from states that cannot safely pause', () => {
    const selectionRequired = reduceJob(inspectingJob, {
      type: 'PREVIEW_READY',
      preview: carousel,
    });
    const paused = reduceJob(downloadingJob, { type: 'OFFLINE' });
    const exporting = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1.mp4',
    });
    const complete = reduceJob(exporting, {
      type: 'EXPORT_SUCCEEDED',
      assetUri: 'ph://saved-asset',
    });
    const failed = reduceJob(downloadingJob, {
      type: 'FAILED',
      failure: { reason: 'permission', retryable: false },
    });
    const prohibitedJobs: DownloadJob[] = [
      selectionRequired,
      paused,
      exporting,
      complete,
      failed,
      reduceJob(downloadingJob, { type: 'CANCELLED' }),
    ];

    for (const job of prohibitedJobs) {
      expect(() => reduceJob(job, { type: 'OFFLINE' })).toThrow(
        /illegal transition/i,
      );
    }
    expect(reduceJob(inspectingJob, { type: 'OFFLINE' })).toMatchObject({
      status: 'paused_offline', resumeStatus: 'inspecting', resumeJob: inspectingJob,
    });
  });

  test('allows cancellation from active states', () => {
    const activeJobs: DownloadJob[] = [
      { ...inspectingJob, status: 'queued' },
      inspectingJob,
      reduceJob(inspectingJob, { type: 'PREVIEW_READY', preview: carousel }),
      selectedJob,
      downloadingJob,
      reduceJob(downloadingJob, { type: 'OFFLINE' }),
      reduceJob(downloadingJob, {
        type: 'DOWNLOAD_SUCCEEDED',
        temporaryUri: 'file:///tmp/job-1.mp4',
      }),
    ];

    for (const job of activeJobs) {
      expect(reduceJob(job, { type: 'CANCELLED' }).status).toBe('cancelled');
    }
  });

  test('rejects cancellation and failure after a terminal state', () => {
    const exporting = reduceJob(downloadingJob, {
      type: 'DOWNLOAD_SUCCEEDED',
      temporaryUri: 'file:///tmp/job-1.mp4',
    });
    const terminalJobs: DownloadJob[] = [
      reduceJob(exporting, {
        type: 'EXPORT_SUCCEEDED',
        assetUri: 'ph://saved-asset',
      }),
      reduceJob(downloadingJob, {
        type: 'FAILED',
        failure: { reason: 'provider', retryable: true },
      }),
      reduceJob(downloadingJob, { type: 'CANCELLED' }),
    ];

    for (const job of terminalJobs) {
      expect(() => reduceJob(job, { type: 'CANCELLED' })).toThrow(
        /illegal transition/i,
      );
      expect(() =>
        reduceJob(job, {
          type: 'FAILED',
          failure: { reason: 'unknown', retryable: false },
        }),
      ).toThrow(/illegal transition/i);
    }
  });

  test('rejects events that are invalid for the current nonterminal state', () => {
    expect(() =>
      reduceJob(inspectingJob, {
        type: 'DOWNLOAD_STARTED',
        temporaryUri: 'file:///tmp/job-1.mp4',
      }),
    ).toThrow(/illegal transition/i);
    expect(() => reduceJob(downloadingJob, { type: 'ONLINE' })).toThrow(
      /illegal transition/i,
    );
    expect(() => reduceJob(downloadingJob, { type: 'RETRY' })).toThrow(
      /illegal transition/i,
    );
  });
});
