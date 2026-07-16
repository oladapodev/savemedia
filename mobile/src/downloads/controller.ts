import type { ApiFailure, DownloadResult } from '../api/types';
import { mediaIdentityFromUrl } from '../share/identity';
import { detectKnownPlatform, extractSharedUrl } from '../share/url';
import { reduceJob } from './reducer';
import { MAX_DIRECT_MEDIA_BYTES } from './types';
import { inferConcreteMediaMime } from '../files/mime';
import type {
  DownloadFailure,
  DownloadJob,
  DownloadPreview,
  DownloadSelection,
  DownloadTransferMetadata,
  DirectMediaInput,
  MediaType,
} from './types';
import type { BackgroundEvent, DownloadPorts } from './ports';

type Candidate = { url: string; filename: string; mediaType: MediaType; transfer?: DownloadTransferMetadata };
type DownloadQuality = 'balanced' | 'original' | 'audio';

type Started = { kind: 'started'; job: DownloadJob };
type SelectionRequired = { kind: 'selection_required'; job: DownloadJob };
type Duplicate = { kind: 'duplicate'; jobId: string };
type InvalidUrl = { kind: 'invalid_url' };
type Failed = { kind: 'failed'; job: DownloadJob };

export type StartResult = Started | SelectionRequired | Duplicate | InvalidUrl | Failed;
type RetryResult = StartResult | DownloadJob | undefined;

export type DownloadController = {
  get(id: string): DownloadJob | undefined;
  list(): DownloadJob[];
  subscribe(listener: (job: DownloadJob) => void): () => void;
  hydrate(): Promise<void>;
  startFromText(text: string, quality?: DownloadQuality, options?: { allowDuplicate?: boolean }): Promise<StartResult>;
  startFromDirectFiles(files: readonly DirectMediaInput[]): Promise<StartResult>;
  choose(id: string, selection: DownloadSelection): Promise<DownloadJob | undefined>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<StartResult | DownloadJob | undefined>;
  setOnline(online: boolean): Promise<void>;
  reconcile(): Promise<void>;
};

function toFailure(failure: ApiFailure): DownloadFailure {
  if (failure.reason === 'network') {
    return { reason: 'offline', retryable: true, message: failure.message };
  }
  if (failure.reason === 'unsupported' || failure.reason === 'private' || failure.reason === 'not_found') {
    return { reason: failure.reason, retryable: false, message: failure.message };
  }
  return {
    reason: failure.reason === 'provider' ? 'provider' : 'unknown',
    retryable: failure.retryable,
    message: failure.message,
  };
}

function isApiFailure(value: { kind: string }): value is ApiFailure {
  return value.kind === 'failure';
}

async function onceRetry<T extends { kind: string }>(
  request: () => Promise<T>,
  budget: { remaining: number },
): Promise<T> {
  const first = await request();
  if (isApiFailure(first) && first.reason === 'provider' && first.retryable && budget.remaining > 0) {
    budget.remaining -= 1;
    return request();
  }
  return first;
}

function transferFromCandidate(
  candidate: Candidate,
  details: Partial<DownloadTransferMetadata> = {},
): DownloadTransferMetadata {
  const concreteMime = inferConcreteMediaMime({
    declaredMimeType: details.mimeType,
    filename: candidate.filename,
    mediaType: candidate.mediaType,
    url: candidate.url,
  });
  if (!candidate.transfer && !concreteMime) throw new Error('unsupported_mime');
  return candidate.transfer ?? {
    downloadUrl: candidate.url,
    filename: candidate.filename,
    mediaType: candidate.mediaType,
    mimeType: concreteMime!,
    ...details,
  };
}

function candidatesFrom(
  result: Exclude<DownloadResult, ApiFailure>,
  sourceUrl: string,
  quality: DownloadQuality,
  thumbnailUrl?: string,
): {
  preview: DownloadPreview;
  candidates: Map<string, Candidate>;
} {
  const candidates = new Map<string, Candidate>();
  const items = result.kind === 'direct'
    ? [{ id: 'item-1', downloadUrl: result.downloadUrl, mediaType: result.mediaType, filename: result.filename, mimeType: result.mimeType }]
    : result.items;
  const previewItems = items.map((item) => {
    const variantId = `variant:${item.id}`;
    const candidate: Candidate = {
      url: item.downloadUrl,
      filename: item.filename,
      mediaType: item.mediaType,
      transfer: {
        downloadUrl: item.downloadUrl,
        filename: item.filename,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        quality,
        platform: result.platform,
        mediaIdentity: mediaIdentityFromUrl(sourceUrl),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      },
    };
    candidates.set(variantId, candidate);
    return {
      id: item.id,
      mediaType: item.mediaType,
      variants: [{
        id: variantId,
        mediaType: item.mediaType,
        reliable: true,
        transfer: candidate.transfer,
        ...(item.mediaType === 'video' ? { height: 720 } : {}),
      }],
    };
  });
  return { preview: { items: previewItems }, candidates };
}

function fileFailure(error: unknown): DownloadFailure | null {
  if (!error || typeof error !== 'object' || !('reason' in error)) return null;
  const reason = error.reason;
  if (reason === 'permission' || reason === 'storage' || reason === 'invalid_file') {
    return {
      reason,
      retryable: reason === 'permission',
      message: error instanceof Error ? error.message : undefined,
    };
  }
  return null;
}

function eventTransfer(event: BackgroundEvent): DownloadTransferMetadata | undefined {
  if (!event.filename || !event.mediaType) return undefined;
  const concreteMime = inferConcreteMediaMime({
    declaredMimeType: event.mimeType,
    filename: event.filename,
    mediaType: event.mediaType,
    url: event.fileUri,
  });
  if (!concreteMime) return undefined;
  return {
    downloadUrl: '',
    filename: event.filename,
    mediaType: event.mediaType,
    mimeType: concreteMime,
  };
}

export function createDownloadController(
  ports: DownloadPorts,
  onPublish?: (job: DownloadJob) => void,
): DownloadController {
  const jobs = new Map<string, DownloadJob>();
  const sourceReservations = new Map<string, string>();
  const directReservations = new Map<string, string>();
  const jobCandidates = new Map<string, Map<string, Candidate>>();
  const listeners = new Set<(job: DownloadJob) => void>();
  const reconciling = new Set<string>();
  const mutations = new Map<string, Promise<DownloadJob>>();
  const retrying = new Map<string, Promise<RetryResult>>();
  let hydration: Promise<void> | null = null;
  let reconciliation: Promise<void> | null = null;
  let reconciliationRequested = false;
  let online = true;
  if (onPublish) listeners.add(onPublish);

  const reservationKey = (sourceUrl: string) => mediaIdentityFromUrl(sourceUrl);

  function directIdentityKeys(job: DownloadJob): string[] {
    const identities = [job.transfer?.mediaIdentity];
    if (job.preview) {
      for (const item of job.preview.items) {
        for (const variant of item.variants) identities.push(variant.transfer?.mediaIdentity);
      }
    }
    return identities.filter((identity): identity is string => Boolean(identity?.startsWith('local:')));
  }

  function releaseDirectReservations(jobId: string): void {
    for (const [identity, reservedJobId] of directReservations) {
      if (reservedJobId === jobId) directReservations.delete(identity);
    }
  }

  function applyInMemory(job: DownloadJob): DownloadJob {
    jobs.set(job.id, job);
    const key = reservationKey(job.sourceUrl);
    if (job.status === 'failed' || job.status === 'cancelled') {
      if (sourceReservations.get(key) === job.id) sourceReservations.delete(key);
      releaseDirectReservations(job.id);
    } else {
      sourceReservations.set(key, job.id);
      for (const identity of directIdentityKeys(job)) directReservations.set(identity, job.id);
    }
    for (const listener of listeners) {
      try { listener(job); } catch { /* UI listeners cannot invalidate durable state. */ }
    }
    return job;
  }

  async function persistInitial(job: DownloadJob): Promise<DownloadJob> {
    const previous = mutations.get(job.id);
    const write = async () => {
      await ports.jobs.save(job);
      return applyInMemory(job);
    };
    const pending = previous ? previous.then(write) : write();
    mutations.set(job.id, pending);
    return pending;
  }

  async function dispatch(
    job: DownloadJob,
    event: Parameters<typeof reduceJob>[1],
  ): Promise<DownloadJob> {
    const previous = mutations.get(job.id);
    const write = async () => {
      const current = jobs.get(job.id);
      if (!current || current !== job) return current ?? job;
      const next = reduceJob(current, event);
      await ports.jobs.save(next);
      return applyInMemory(next);
    };
    const pending = previous ? previous.then(write) : write();
    mutations.set(job.id, pending);
    return pending;
  }

  async function fail(job: DownloadJob, failure: DownloadFailure): Promise<DownloadJob> {
    return dispatch(job, { type: 'FAILED', failure });
  }

  function candidateFor(job: DownloadJob): Candidate | undefined {
    if (!job.selection) return undefined;
    const cached = jobCandidates.get(job.id)?.get(job.selection.variant.id);
    if (cached) return cached;
  const transfer = job.selection.variant.transfer ?? job.transfer;
    return transfer
      ? { url: transfer.downloadUrl, filename: transfer.filename, mediaType: transfer.mediaType, transfer }
      : undefined;
  }

  async function enqueue(job: DownloadJob): Promise<DownloadJob> {
    if (job.status !== 'preparing') return job;
    const candidate = candidateFor(job);
    if (!candidate) {
      return fail(job, { reason: 'unknown', retryable: false, message: 'No selected media was found.' });
    }
    const transfer = transferFromCandidate(candidate);
    const temporaryUri = ports.files.temporaryUri({ id: job.id, filename: transfer.filename });
    const active = await dispatch(job, { type: 'DOWNLOAD_STARTED', temporaryUri, transfer });
    try {
      await ports.background.enqueue({
        id: active.id,
        url: transfer.downloadUrl,
        ...transfer,
        temporaryUri,
      });
      return jobs.get(active.id) ?? active;
    } catch {
      const current = jobs.get(active.id);
      return current === active
        ? fail(active, { reason: 'provider', retryable: true, message: 'The download could not be queued.' })
        : current ?? active;
    }
  }

  async function removeTemporaryUris(uris: readonly string[]): Promise<void> {
    for (const uri of new Set(uris)) {
      try { await ports.files.removeTemporary(uri); } catch { /* Explicit cleanup can retry later. */ }
    }
  }

  async function processDirect(
    job: Extract<DownloadJob, { status: 'preparing' }>,
    candidate: Candidate,
    unselectedUris: readonly string[] = [],
  ): Promise<DownloadJob> {
    const transfer = transferFromCandidate(candidate);
    const temporaryUri = transfer.downloadUrl;
    const active = await dispatch(job, { type: 'DOWNLOAD_STARTED', temporaryUri, transfer });
    await removeTemporaryUris(unselectedUris);
    await complete(active, {
      id: active.id,
      status: 'complete',
      fileUri: temporaryUri,
      sizeBytes: transfer.sizeBytes,
      filename: transfer.filename,
      mediaType: transfer.mediaType,
      mimeType: transfer.mimeType,
    });
    return jobs.get(active.id) ?? active;
  }

  async function reenqueue(job: Extract<DownloadJob, { status: 'downloading' }>): Promise<DownloadJob> {
    const transfer = job.transfer ?? job.selection.variant.transfer;
    if (!transfer) return fail(job, { reason: 'unknown', retryable: false, message: 'Persisted transfer metadata is missing.' });
    try {
      await ports.background.enqueue({
        id: job.id,
        url: transfer.downloadUrl,
        ...transfer,
        temporaryUri: job.temporaryUri,
      });
      return jobs.get(job.id) ?? job;
    } catch {
      const current = jobs.get(job.id);
      return current === job
        ? fail(job, { reason: 'provider', retryable: true, message: 'The download could not be restarted.' })
        : current ?? job;
    }
  }

  async function complete(job: DownloadJob, event: BackgroundEvent): Promise<void> {
    if ((job.status !== 'downloading' && job.status !== 'exporting') || !event.fileUri || reconciling.has(job.id)) return;
    const transfer = job.transfer ?? eventTransfer(event);
    if (!transfer) {
      await fail(job, { reason: 'unknown', retryable: false, message: 'Downloaded media could not be identified.' });
      return;
    }

    reconciling.add(job.id);
    try {
      let exporting: Extract<DownloadJob, { status: 'downloading' | 'exporting' }> = job;
      if (exporting.status === 'downloading') {
        const next = await dispatch(exporting, { type: 'DOWNLOAD_SUCCEEDED', temporaryUri: event.fileUri });
        if (next.status !== 'exporting') return;
        exporting = next;
      }
      if (exporting.status !== 'exporting') return;

      const recorded = await ports.history.findByJobId(job.id);
      let assetUri = recorded?.assetUri || exporting.assetUri;
      if (!assetUri) {
        const exported = await ports.files.export(event.fileUri, {
          filename: transfer.filename,
          mediaType: transfer.mediaType,
        });
        assetUri = exported.assetUri;
        if (jobs.get(job.id) !== exporting) {
          try { await ports.files.deleteAsset(assetUri); } catch { /* Cancellation remains authoritative. */ }
          return;
        }
        const next = await dispatch(exporting, { type: 'ASSET_EXPORTED', assetUri });
        if (next.status !== 'exporting') return;
        exporting = next;
      }

      if (!recorded) {
        if (jobs.get(job.id) !== exporting) return;
        await ports.history.save({
          jobId: job.id,
          sourceUrl: job.sourceUrl,
          assetUri,
          filename: transfer.filename,
          mediaType: transfer.mediaType,
          mimeType: transfer.mimeType,
          ...(event.sizeBytes ?? transfer.sizeBytes ? { sizeBytes: event.sizeBytes ?? transfer.sizeBytes } : {}),
          quality: transfer.quality ?? job.selection?.quality ?? 'balanced',
          platform: transfer.platform ?? detectKnownPlatform(job.sourceUrl) ?? 'unknown',
          ...(transfer.thumbnailUrl ? { thumbnailUrl: transfer.thumbnailUrl } : {}),
          mediaIdentity: transfer.mediaIdentity ?? mediaIdentityFromUrl(job.sourceUrl),
          sourceKind: transfer.sourceKind ?? 'remote',
          completedAt: ports.now(),
        });
      }

      const current = jobs.get(job.id);
      if (!current || current !== exporting || current.status !== 'exporting') return;
      const saved = await dispatch(current, { type: 'EXPORT_SUCCEEDED', assetUri });
      if (saved.status !== 'complete') return;
      try { await ports.notifications.complete(saved); } catch { /* Saved media is authoritative. */ }
      try { await ports.files.removeTemporary(event.fileUri); } catch { /* Retry cleanup later. */ }
    } catch (error) {
      const failure = fileFailure(error);
      const current = jobs.get(job.id);
      const visibleFailure = failure ?? (transfer.sourceKind === 'device-share'
        ? {
            reason: 'storage' as const,
            retryable: true,
            message: 'Saved media could not be recorded. Retry to finish without exporting it again.',
          }
        : null);
      if (visibleFailure && current && current.status !== 'failed' && current.status !== 'complete' && current.status !== 'cancelled') {
        await fail(current, visibleFailure);
      }
    } finally {
      reconciling.delete(job.id);
    }
  }

  async function hydrate(): Promise<void> {
    if (!hydration) {
      hydration = ports.jobs.listActive().then((active) => {
        for (const job of active) applyInMemory(job);
      }).catch((error) => {
        hydration = null;
        throw error;
      });
    }
    await hydration;
  }

  async function inspect(job: DownloadJob, quality: DownloadQuality = 'balanced'): Promise<DownloadJob> {
    let inspecting = job;
    if (inspecting.status === 'queued') inspecting = await dispatch(inspecting, { type: 'INSPECTION_STARTED' });
    if (inspecting.status !== 'inspecting') return inspecting;
    const retryBudget = { remaining: 1 };
    const preview = await onceRetry(() => ports.api.preview(inspecting.sourceUrl), retryBudget);
    if (jobs.get(inspecting.id) !== inspecting) return jobs.get(inspecting.id) ?? inspecting;
    if (preview.kind === 'failure') return fail(inspecting, toFailure(preview));
    const download = await onceRetry(() => ports.api.download(inspecting.sourceUrl, quality), retryBudget);
    if (jobs.get(inspecting.id) !== inspecting) return jobs.get(inspecting.id) ?? inspecting;
    if (download.kind === 'failure') return fail(inspecting, toFailure(download));

    const media = candidatesFrom(download, inspecting.sourceUrl, quality, preview.thumbnail);
    jobCandidates.set(inspecting.id, media.candidates);
    const withTitle: DownloadPreview = { ...media.preview, ...(preview.title ? { title: preview.title } : {}) };
    const prepared = await dispatch(inspecting, { type: 'PREVIEW_READY', preview: withTitle });
    return prepared.status === 'preparing' ? enqueue(prepared) : prepared;
  }

  async function resume(job: DownloadJob): Promise<void> {
    if (!online) return;
    if (job.status === 'queued' || job.status === 'inspecting') {
      await inspect(job);
    } else if (job.status === 'preparing') {
      await enqueue(job);
    } else if (job.status === 'downloading') {
      await reenqueue(job);
    } else if (job.status === 'exporting') {
      await complete(job, { id: job.id, status: 'complete', fileUri: job.temporaryUri });
    }
  }

  async function setOnline(nextOnline: boolean): Promise<void> {
    online = nextOnline;
    const currentJobs = [...jobs.values()];
    if (!nextOnline) {
      for (const job of currentJobs) {
        if (job.status === 'queued' || job.status === 'inspecting' || job.status === 'preparing' || job.status === 'downloading') {
          await dispatch(job, { type: 'OFFLINE' });
        }
      }
      return;
    }
    for (const job of currentJobs) {
      if (job.status !== 'paused_offline') continue;
      const resumed = await dispatch(job, { type: 'ONLINE' });
      await resume(resumed);
    }
  }

  async function performReconcile(): Promise<void> {
    await hydrate();
    if (ports.network) online = (await ports.network.getCurrent()).online;
    const events = await ports.background.list();
    const nativeIds = new Set(events.map((event) => event.id));
    for (const event of events) {
      const job = jobs.get(event.id);
      if (!job) continue;
      const totalBytes = event.totalBytes && event.totalBytes > 0 ? event.totalBytes : undefined;
      if (event.bytesWritten !== undefined
        && (job.status === 'downloading'
          || (job.status === 'paused_offline' && job.resumeJob.status === 'downloading'))
        && (job.progress?.bytesWritten !== event.bytesWritten
          || job.progress?.totalBytes !== totalBytes)) {
        await dispatch(job, {
          type: 'DOWNLOAD_PROGRESS',
          bytesWritten: event.bytesWritten,
          ...(totalBytes === undefined ? {} : { totalBytes }),
        });
      }
      if (event.status === 'complete') await complete(jobs.get(event.id) ?? job, event);
      const current = jobs.get(event.id);
      if (!current) continue;
      if (event.status === 'failed' && current.status !== 'complete' && current.status !== 'failed' && current.status !== 'cancelled') {
        const partialUri = event.fileUri ?? current.temporaryUri;
        await fail(current, { reason: 'provider', retryable: true, message: event.errorCode });
        if (partialUri) {
          try { await ports.files.removeTemporary(partialUri); } catch { /* Explicit cleanup can retry. */ }
        }
      }
      if (event.status === 'cancelled' && current.status !== 'complete' && current.status !== 'failed' && current.status !== 'cancelled' && current.status !== 'paused_offline') {
        await dispatch(current, { type: 'CANCELLED' });
        const temporaryUri = event.fileUri ?? current.temporaryUri;
        if (temporaryUri) {
          try { await ports.files.removeTemporary(temporaryUri); } catch { /* Explicit cleanup can retry. */ }
        }
      }
    }

    for (const job of [...jobs.values()]) {
      const current = jobs.get(job.id);
      if (current !== job || current.status === 'failed' || current.status === 'cancelled' || current.status === 'complete' || current.status === 'selection_required') continue;
      if (current.status === 'paused_offline') {
        if (online) {
          const resumed = await dispatch(current, { type: 'ONLINE' });
          await resume(resumed);
        }
      } else if (current.status === 'downloading') {
        if (online && !nativeIds.has(current.id)) await reenqueue(current);
      } else if (current.status === 'exporting') {
        if (!nativeIds.has(current.id)) {
          await complete(current, { id: current.id, status: 'complete', fileUri: current.temporaryUri });
        }
      } else if (online) {
        await resume(current);
      } else if (current.status === 'queued' || current.status === 'inspecting' || current.status === 'preparing') {
        await dispatch(current, { type: 'OFFLINE' });
      }
    }
  }

  function reconcile(): Promise<void> {
    if (reconciliation) {
      reconciliationRequested = true;
      return reconciliation;
    }
    const operation = (async () => {
      let failure: unknown;
      do {
        reconciliationRequested = false;
        try {
          await performReconcile();
          failure = undefined;
        } catch (error) {
          failure = error;
        }
      } while (reconciliationRequested);
      if (failure) throw failure;
    })().finally(() => {
      if (reconciliation === operation) reconciliation = null;
    });
    reconciliation = operation;
    return operation;
  }

  async function performRetry(id: string): Promise<RetryResult> {
    const job = jobs.get(id);
    if (job?.status === 'paused_offline') {
      online = ports.network ? (await ports.network.getCurrent()).online : online;
      if (!online) return job;
      const resumed = await dispatch(job, { type: 'ONLINE' });
      await resume(resumed);
      return jobs.get(id);
    }
    if (!job || job.status !== 'failed' || !job.failure.retryable) return undefined;
    const recovery = job.recovery;
    if (recovery?.selection && recovery.temporaryUri && recovery.transfer) {
      const resumed: DownloadJob = {
        id: job.id,
        sourceUrl: job.sourceUrl,
        status: 'exporting',
        selection: recovery.selection,
        temporaryUri: recovery.temporaryUri,
        transfer: recovery.transfer,
        ...(recovery.assetUri ? { assetUri: recovery.assetUri } : {}),
      };
      await persistInitial(resumed);
      await complete(resumed, { id: resumed.id, status: 'complete', fileUri: resumed.temporaryUri });
      return jobs.get(id);
    }
    jobs.delete(id);
    const key = reservationKey(job.sourceUrl);
    if (sourceReservations.get(key) === id) sourceReservations.delete(key);
    return controller.startFromText(job.sourceUrl);
  }

  function retry(id: string): Promise<RetryResult> {
    const active = retrying.get(id);
    if (active) return active;
    const operation = performRetry(id).finally(() => {
      if (retrying.get(id) === operation) retrying.delete(id);
    });
    retrying.set(id, operation);
    return operation;
  }

  const controller: DownloadController = {
    get: (id) => jobs.get(id),
    list: () => [...jobs.values()],
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hydrate,
    async startFromText(text, quality = 'balanced', options = {}) {
      const shared = extractSharedUrl(text);
      if (!shared) return { kind: 'invalid_url' };
      const key = reservationKey(shared.url);
      const reservedJobId = sourceReservations.get(key);
      if (!options.allowDuplicate && reservedJobId) return { kind: 'duplicate', jobId: reservedJobId };

      const jobId = ports.id();
      sourceReservations.set(key, jobId);
      let job: DownloadJob;
      try {
        const duplicate = options.allowDuplicate ? null : await ports.history.findBySourceUrl(shared.url);
        if (duplicate) {
          sourceReservations.set(key, duplicate.jobId);
          return { kind: 'duplicate', jobId: duplicate.jobId };
        }

        job = await persistInitial({ id: jobId, sourceUrl: shared.url, status: 'queued' });
      } catch (error) {
        if (!jobs.has(jobId) && sourceReservations.get(key) === jobId) {
          sourceReservations.delete(key);
        }
        throw error;
      }

      job = await inspect(job, quality);
      if (job.status === 'selection_required') return { kind: 'selection_required', job };
      return job.status === 'failed' ? { kind: 'failed', job } : { kind: 'started', job };
    },
    async startFromDirectFiles(files) {
      const jobId = ports.id();
      const sourceUrl = `shared-media://${jobId}`;
      let job = await persistInitial({ id: jobId, sourceUrl, status: 'queued' });
      const imported: Array<{
        input: DirectMediaInput;
        temporaryUri: string;
        sizeBytes: number;
        fingerprint: string;
      }> = [];
      const fingerprints = new Set<string>();

      try {
        if (!files.length) {
          return { kind: 'failed', job: await fail(job, {
            reason: 'invalid_file', retryable: false, message: 'No shared media was provided.',
          }) };
        }
        if (!ports.files.importIncoming) {
          return { kind: 'failed', job: await fail(job, {
            reason: 'invalid_file', retryable: false, message: 'Direct media import is unavailable.',
          }) };
        }

        for (const [index, input] of files.entries()) {
          const temporaryUri = ports.files.temporaryUri({ id: `${jobId}-${index + 1}`, filename: input.filename });
          const result = await ports.files.importIncoming({
            sourceUri: input.sourceUri,
            temporaryUri,
            filename: input.filename,
            mediaType: input.mediaType,
            mimeType: input.mimeType,
            declaredSizeBytes: input.sizeBytes,
            maxBytes: MAX_DIRECT_MEDIA_BYTES,
            sourceOwnership: input.sourceOwnership,
          });
          imported.push({ input, ...result });
          if (fingerprints.has(result.fingerprint)) {
            await removeTemporaryUris(imported.map((item) => item.temporaryUri));
            return { kind: 'failed', job: await fail(job, {
              reason: 'invalid_file', retryable: false, message: 'The same shared media was included more than once.',
            }) };
          }
          fingerprints.add(result.fingerprint);

          const reservedJobId = directReservations.get(result.fingerprint);
          if (reservedJobId && reservedJobId !== jobId) {
            await removeTemporaryUris(imported.map((item) => item.temporaryUri));
            await dispatch(job, { type: 'CANCELLED' });
            return { kind: 'duplicate', jobId: reservedJobId };
          }
          directReservations.set(result.fingerprint, jobId);
          const duplicate = await ports.history.findByMediaIdentity?.(result.fingerprint);
          if (duplicate) {
            directReservations.set(result.fingerprint, duplicate.jobId);
            await removeTemporaryUris(imported.map((item) => item.temporaryUri));
            await dispatch(job, { type: 'CANCELLED' });
            return { kind: 'duplicate', jobId: duplicate.jobId };
          }
        }

        const candidates = new Map<string, Candidate>();
        const preview: DownloadPreview = {
          title: files.length === 1 ? files[0].filename : `${files.length} shared media items`,
          items: imported.map(({ input, temporaryUri, sizeBytes, fingerprint }, index) => {
            const itemId = `shared-item-${index + 1}`;
            const variantId = `shared-variant-${index + 1}`;
            const transfer: DownloadTransferMetadata = {
              downloadUrl: temporaryUri,
              filename: input.filename,
              mediaType: input.mediaType,
              mimeType: input.mimeType,
              sizeBytes,
              quality: 'original',
              platform: 'device',
              mediaIdentity: fingerprint,
              sourceKind: 'device-share',
            };
            candidates.set(variantId, {
              url: temporaryUri, filename: input.filename, mediaType: input.mediaType, transfer,
            });
            return {
              id: itemId,
              mediaType: input.mediaType,
              variants: [{ id: variantId, mediaType: input.mediaType, reliable: true, sizeBytes, transfer }],
            };
          }),
        };
        jobCandidates.set(jobId, candidates);
        job = await dispatch(job, { type: 'INSPECTION_STARTED' });
        job = await dispatch(job, { type: 'PREVIEW_READY', preview });
        if (job.status === 'selection_required') return { kind: 'selection_required', job };
        if (job.status !== 'preparing') return { kind: 'failed', job: await fail(job, {
          reason: 'invalid_file', retryable: false, message: 'Shared media could not be prepared.',
        }) };
        const candidate = candidateFor(job);
        if (!candidate) return { kind: 'failed', job: await fail(job, {
          reason: 'invalid_file', retryable: false, message: 'Shared media metadata is missing.',
        }) };
        const saved = await processDirect(job, candidate);
        return saved.status === 'failed' ? { kind: 'failed', job: saved } : { kind: 'started', job: saved };
      } catch (error) {
        await removeTemporaryUris(imported.map((item) => item.temporaryUri));
        const current = jobs.get(jobId) ?? job;
        const failure = fileFailure(error) ?? {
          reason: 'invalid_file' as const,
          retryable: false,
          message: error instanceof Error ? error.message : 'Shared media could not be imported.',
        };
        if (current.status === 'failed') return { kind: 'failed', job: current };
        return { kind: 'failed', job: await fail(current, failure) };
      }
    },
    async choose(id, selection) {
      const job = jobs.get(id);
      if (!job || job.status !== 'selection_required') return undefined;
      const candidate = jobCandidates.get(id)?.get(selection.variant.id)
        ?? (selection.variant.transfer ? {
          url: selection.variant.transfer.downloadUrl,
          filename: selection.variant.transfer.filename,
          mediaType: selection.variant.transfer.mediaType,
          transfer: selection.variant.transfer,
        } : undefined);
      const unselectedUris = job.preview.items.flatMap((item) => item.variants)
        .filter((variant) => variant.id !== selection.variant.id && variant.transfer?.sourceKind === 'device-share')
        .map((variant) => variant.transfer!.downloadUrl);
      const prepared = await dispatch(job, { type: 'SELECTION_CONFIRMED', selection });
      if (prepared.status !== 'preparing') return prepared;
      if (candidate?.transfer?.sourceKind === 'device-share') {
        return processDirect(prepared, candidate, unselectedUris);
      }
      return enqueue(prepared);
    },
    async cancel(id) {
      const job = jobs.get(id);
      if (!job || job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') return;
      await dispatch(job, { type: 'CANCELLED' });
      const directUris = job.preview?.items.flatMap((item) => item.variants)
        .filter((variant) => variant.transfer?.sourceKind === 'device-share')
        .map((variant) => variant.transfer!.downloadUrl) ?? [];
      if (job.transfer?.sourceKind === 'device-share' && job.temporaryUri) directUris.push(job.temporaryUri);
      if (!directUris.length) {
        try { await ports.background.cancel(id); } catch { /* State still needs cancellation. */ }
      }
      await removeTemporaryUris(job.temporaryUri ? [...directUris, job.temporaryUri] : directUris);
    },
    retry,
    setOnline,
    reconcile,
  };
  return controller;
}
