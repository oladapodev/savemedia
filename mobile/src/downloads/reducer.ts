import { selectBalanced } from './quality';
import type {
  DownloadJob,
  DownloadJobEvent,
  DownloadPreview,
  DownloadRecoveryContext,
  DownloadSelection,
} from './types';

function illegalTransition(job: DownloadJob, event: DownloadJobEvent): never {
  throw new Error(`Illegal transition: ${job.status} cannot handle ${event.type}`);
}

function automaticSelection(
  preview: DownloadPreview,
): DownloadSelection | undefined {
  if (preview.items.length !== 1) return undefined;
  const [item] = preview.items;
  if (item.mediaType === 'video') {
    const directVariant = item.variants.find((variant) => (
      variant.reliable && variant.transfer?.sourceKind === 'device-share'
    ));
    if (directVariant) {
      return { itemId: item.id, quality: 'original', variant: directVariant };
    }
    const variant = selectBalanced(item.variants);
    return variant
      ? { itemId: item.id, quality: 'balanced', variant }
      : undefined;
  }

  const variants = item.variants.filter(
    (variant) => variant.mediaType === item.mediaType && variant.reliable,
  );
  if (variants.length !== 1) return undefined;
  return {
    itemId: item.id,
    quality: item.mediaType === 'audio' ? 'audio' : 'original',
    variant: variants[0],
  };
}

function isSelectionFromPreview(
  preview: DownloadPreview,
  selection: DownloadSelection,
): boolean {
  const item = preview.items.find((candidate) => candidate.id === selection.itemId);
  return item?.variants.some((variant) => variant.id === selection.variant.id) ?? false;
}

function cancelled(job: DownloadJob): DownloadJob {
  return { id: job.id, sourceUrl: job.sourceUrl, status: 'cancelled' };
}

function recoveryContext(job: DownloadJob): DownloadRecoveryContext | undefined {
  const recoverableJob =
    job.status === 'paused_offline' ? job.resumeJob : job;
  const recovery: DownloadRecoveryContext = {};

  if (recoverableJob.preview) recovery.preview = recoverableJob.preview;
  if (recoverableJob.selection) recovery.selection = recoverableJob.selection;
  if (recoverableJob.temporaryUri) {
    recovery.temporaryUri = recoverableJob.temporaryUri;
  }
  if (recoverableJob.transfer) recovery.transfer = recoverableJob.transfer;
  if (recoverableJob.assetUri) recovery.assetUri = recoverableJob.assetUri;

  return Object.keys(recovery).length > 0 ? recovery : undefined;
}

function failed(
  job: DownloadJob,
  failure: Extract<DownloadJobEvent, { type: 'FAILED' }>['failure'],
): Extract<DownloadJob, { status: 'failed' }> {
  const recovery = recoveryContext(job);
  return {
    id: job.id,
    sourceUrl: job.sourceUrl,
    status: 'failed',
    failure,
    ...(recovery ? { recovery } : {}),
  };
}

export function reduceJob(
  job: DownloadJob,
  event: Extract<DownloadJobEvent, { type: 'FAILED' }>,
): Extract<DownloadJob, { status: 'failed' }>;
export function reduceJob(job: DownloadJob, event: DownloadJobEvent): DownloadJob;
export function reduceJob(job: DownloadJob, event: DownloadJobEvent): DownloadJob {
  if (event.type === 'CANCELLED') {
    if (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') {
      return illegalTransition(job, event);
    }
    return cancelled(job);
  }

  if (event.type === 'FAILED') {
    if (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') {
      return illegalTransition(job, event);
    }
    return failed(job, event.failure);
  }

  if (event.type === 'DOWNLOAD_PROGRESS') {
    if (!Number.isSafeInteger(event.bytesWritten) || event.bytesWritten < 0
      || (event.totalBytes !== undefined
        && (!Number.isSafeInteger(event.totalBytes) || event.totalBytes <= 0))) {
      return illegalTransition(job, event);
    }
    const progress = {
      bytesWritten: event.bytesWritten,
      ...(event.totalBytes === undefined ? {} : { totalBytes: event.totalBytes }),
    };
    if (job.status === 'downloading') return { ...job, progress };
    if (job.status === 'paused_offline' && job.resumeJob.status === 'downloading') {
      return { ...job, progress, resumeJob: { ...job.resumeJob, progress } };
    }
    return illegalTransition(job, event);
  }

  switch (job.status) {
    case 'queued':
      if (event.type === 'INSPECTION_STARTED') {
        return { ...job, status: 'inspecting' };
      }
      if (event.type === 'OFFLINE') {
        return {
          id: job.id,
          sourceUrl: job.sourceUrl,
          status: 'paused_offline',
          resumeStatus: 'queued',
          resumeJob: job,
        };
      }
      return illegalTransition(job, event);

    case 'inspecting': {
      if (event.type === 'OFFLINE') {
        return {
          id: job.id,
          sourceUrl: job.sourceUrl,
          status: 'paused_offline',
          resumeStatus: 'inspecting',
          resumeJob: job,
        };
      }
      if (event.type !== 'PREVIEW_READY') return illegalTransition(job, event);
      const selection = automaticSelection(event.preview);
      if (!selection) {
        return { ...job, status: 'selection_required', preview: event.preview };
      }
      return {
        ...job,
        status: 'preparing',
        selection,
      };
    }

    case 'selection_required':
      if (
        event.type === 'SELECTION_CONFIRMED' &&
        isSelectionFromPreview(job.preview, event.selection)
      ) {
        return {
          id: job.id,
          sourceUrl: job.sourceUrl,
          status: 'preparing',
          selection: event.selection,
        };
      }
      return illegalTransition(job, event);

    case 'preparing':
      if (event.type === 'DOWNLOAD_STARTED') {
        return {
          ...job,
          status: 'downloading',
          temporaryUri: event.temporaryUri,
          ...(event.transfer ? { transfer: event.transfer } : {}),
        };
      }
      if (event.type === 'OFFLINE') {
        return {
          id: job.id,
          sourceUrl: job.sourceUrl,
          status: 'paused_offline',
          resumeStatus: 'preparing',
          resumeJob: job,
        };
      }
      return illegalTransition(job, event);

    case 'downloading':
      if (event.type === 'DOWNLOAD_SUCCEEDED') {
        return { ...job, status: 'exporting', temporaryUri: event.temporaryUri };
      }
      if (event.type === 'OFFLINE') {
        return {
          id: job.id,
          sourceUrl: job.sourceUrl,
          status: 'paused_offline',
          resumeStatus: 'downloading',
          resumeJob: job,
        };
      }
      return illegalTransition(job, event);

    case 'paused_offline':
      if (event.type === 'ONLINE') return job.resumeJob;
      return illegalTransition(job, event);

    case 'exporting':
      if (event.type === 'ASSET_EXPORTED') {
        return { ...job, assetUri: event.assetUri };
      }
      if (event.type === 'EXPORT_SUCCEEDED') {
        return { ...job, status: 'complete', assetUri: event.assetUri };
      }
      return illegalTransition(job, event);

    case 'complete':
    case 'cancelled':
      return illegalTransition(job, event);

    case 'failed':
      if (event.type === 'RETRY' && job.failure.retryable) {
        return { id: job.id, sourceUrl: job.sourceUrl, status: 'queued' };
      }
      return illegalTransition(job, event);
  }
}
