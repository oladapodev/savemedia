import type {
  BackgroundDownloads,
  BackgroundEnqueueInput,
  BackgroundEvent,
} from '../downloads/ports';

export interface ActiveTransferDependencies {
  download(input: BackgroundEnqueueInput & { signal: AbortSignal }): Promise<{
    fileUri: string;
    sizeBytes: number;
  }>;
}

type ActiveRecord = {
  event: BackgroundEvent;
  abort?: AbortController;
  settled?: Promise<void>;
};

export function createActiveRuntimeDownloads(native: ActiveTransferDependencies): BackgroundDownloads {
  const records = new Map<string, ActiveRecord>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    async enqueue(input) {
      const existing = records.get(input.id);
      if (existing && existing.event.status !== 'failed' && existing.event.status !== 'cancelled') return;

      const abort = new AbortController();
      const metadata = {
        id: input.id,
        filename: input.filename,
        mediaType: input.mediaType,
        mimeType: input.mimeType,
      };
      const record: ActiveRecord = {
        abort,
        event: { ...metadata, status: 'downloading', fileUri: input.temporaryUri },
      };
      records.set(input.id, record);
      notify();

      record.settled = native.download({ ...input, signal: abort.signal })
        .then((result) => {
          if (record.event.status === 'cancelled') return;
          record.event = {
            ...metadata,
            status: 'complete',
            fileUri: result.fileUri,
            sizeBytes: result.sizeBytes,
          };
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
            record.event = { ...metadata, status: 'cancelled', fileUri: input.temporaryUri };
          } else {
            record.event = {
              ...metadata,
              status: 'failed',
              fileUri: input.temporaryUri,
              errorCode: error instanceof Error ? error.message : 'transfer_failed',
            };
          }
        })
        .finally(notify);
    },

    async cancel(id) {
      const record = records.get(id);
      if (!record) return;
      record.event = { ...record.event, status: 'cancelled' };
      record.abort?.abort();
      await record.settled;
      notify();
    },

    async list() {
      return [...records.values()].map(({ event }) => ({ ...event }));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
