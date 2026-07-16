import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useIncomingShare } from 'expo-sharing';
import type { ResolvedSharePayload } from 'expo-sharing';

import {
  getOptionalNativeDownloads,
  type NativeDownloadsModule,
  type NativeSharedBatch,
} from '../../modules/imediasave-download/src';
import type { IncomingShareSnapshot } from '../share/incoming';

export type IncomingShareAdapterResult = IncomingShareSnapshot & {
  nativeBatchId?: string;
  nativeErrorCode?: string;
  clearSharedPayloads(): Promise<void> | void;
  refreshSharePayloads(): Promise<void> | void;
};

type NativeConsumption = { consumed: boolean; inFlight?: Promise<void> };
const nativeConsumptions = new WeakMap<NativeDownloadsModule, Map<string, NativeConsumption>>();

function clearNativeBatch(native: NativeDownloadsModule, batchId: string): Promise<void> {
  let batches = nativeConsumptions.get(native);
  if (!batches) {
    batches = new Map();
    nativeConsumptions.set(native, batches);
  }
  let state = batches.get(batchId);
  if (!state) {
    state = { consumed: false };
    batches.set(batchId, state);
  }
  if (state.consumed) return Promise.resolve();
  if (state.inFlight) return state.inFlight;
  const operation = native.consumeSharedPayloads(batchId)
    .then(() => { state!.consumed = true; })
    .finally(() => {
      if (state!.inFlight === operation) state!.inFlight = undefined;
    });
  state.inFlight = operation;
  return operation;
}

function emptyIncoming(isResolving: boolean): IncomingShareAdapterResult {
  return {
    sharedPayloads: [],
    resolvedSharedPayloads: [],
    isResolving,
    error: null,
    clearSharedPayloads() {},
    refreshSharePayloads() {},
  };
}

function fromBatch(native: NativeDownloadsModule, batch: NativeSharedBatch): IncomingShareAdapterResult {
  const resolvedSharedPayloads: ResolvedSharePayload[] = batch.payloads.map((payload) => {
    const base = {
      value: payload.value,
      shareType: payload.shareType,
      ...(payload.mimeType ? { mimeType: payload.mimeType } : {}),
      contentMimeType: payload.contentMimeType ?? null,
      originalName: payload.originalName ?? null,
      contentSize: payload.contentSize ?? null,
    };
    if (payload.shareType === 'text') {
      return { ...base, contentUri: null, contentType: 'text' as const };
    }
    return {
      ...base,
      contentUri: payload.contentUri ?? payload.value,
      contentType: payload.contentType === 'website' ? 'website' as const
        : payload.shareType === 'url' ? 'website' as const
          : payload.shareType,
    };
  });
  return {
    sharedPayloads: batch.payloads.map(({ value, shareType, mimeType }) => ({
      value,
      shareType,
      ...(mimeType ? { mimeType } : {}),
    })),
    resolvedSharedPayloads,
    isResolving: false,
    error: batch.errorMessage ? new Error(batch.errorMessage) : null,
    nativeBatchId: batch.id,
    ...(batch.errorCode ? { nativeErrorCode: batch.errorCode } : {}),
    sourceOwnership: 'native-share-queue',
    sourceKey: `${batch.id}:${batch.errorCode ?? 'ok'}`,
    clearSharedPayloads: () => clearNativeBatch(native, batch.id),
    refreshSharePayloads() {},
  };
}

export function nativeShareDedupeKey(incoming: IncomingShareAdapterResult): string {
  return `${incoming.nativeBatchId ?? 'none'}:${incoming.nativeErrorCode ?? 'ok'}`;
}

export function createNativeIncomingShareSource(native: NativeDownloadsModule) {
  return {
    async read(): Promise<IncomingShareAdapterResult | null> {
      const batch = (await native.listSharedPayloads())[0];
      return batch ? fromBatch(native, batch) : null;
    },
    subscribe(listener: () => void): () => void {
      const subscription = native.addListener('onShareQueueChanged', () => listener());
      return () => subscription.remove();
    },
  };
}

export function nativeShareQueueEnabled(platform: string): boolean {
  return platform === 'android' || platform === 'ios';
}

function platformNativeModule(): NativeDownloadsModule | null {
  return nativeShareQueueEnabled(Platform.OS) ? getOptionalNativeDownloads() : null;
}

export function useIncomingShareAdapter(): IncomingShareAdapterResult {
  const expoIncoming = useIncomingShare();
  const native = useMemo(platformNativeModule, []);
  const source = useMemo(() => native ? createNativeIncomingShareSource(native) : null, [native]);
  const [incoming, setIncoming] = useState<IncomingShareAdapterResult>(() => emptyIncoming(Boolean(source)));

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    const refresh = () => {
      source.read().then((next) => {
        if (active) setIncoming(next ?? emptyIncoming(false));
      }).catch((error: unknown) => {
        if (active) {
          setIncoming({
            ...emptyIncoming(false),
            error: error instanceof Error ? error : new Error('Shared content could not be opened.'),
          });
        }
      });
    };
    refresh();
    const unsubscribe = source.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [source]);

  return source ? incoming : expoIncoming;
}

export function usePendingNativeShare(onPending: () => void): void {
  const native = useMemo(platformNativeModule, []);
  const source = useMemo(() => native ? createNativeIncomingShareSource(native) : null, [native]);
  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    let announced: string | null = null;
    const refresh = () => {
      source.read().then((next) => {
        if (!active) return;
        if (!next) {
          announced = null;
          return;
        }
        const key = nativeShareDedupeKey(next);
        if (key !== announced) {
          announced = key;
          onPending();
        }
      }).catch(() => undefined);
    };
    refresh();
    const unsubscribe = source.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [onPending, source]);
}
