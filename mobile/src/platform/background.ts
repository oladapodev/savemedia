import type { BackgroundDownloads, BackgroundEvent } from '../downloads/ports';
import {
  getOptionalNativeDownloads,
  type NativeDownloadsModule,
  type NativeJobEvent,
} from '../../modules/imediasave-download/src';
import { normalizeConcreteMediaMime } from '../files/mime';

export type { NativeDownloadsModule } from '../../modules/imediasave-download/src';

function toBackgroundEvent(event: NativeJobEvent): BackgroundEvent {
  return {
    id: event.id,
    status: event.status,
    ...(event.bytesWritten === undefined ? {} : { bytesWritten: event.bytesWritten }),
    ...(event.totalBytes === undefined ? {} : { totalBytes: event.totalBytes }),
    ...(event.filename ? { filename: event.filename } : {}),
    ...(event.mediaType ? { mediaType: event.mediaType } : {}),
    ...(event.mimeType ? { mimeType: event.mimeType } : {}),
    ...(event.fileUri ? { fileUri: event.fileUri } : {}),
    ...(event.sizeBytes === undefined ? {} : { sizeBytes: event.sizeBytes }),
    ...(event.errorCode ? { errorCode: event.errorCode } : {}),
  };
}

export function createPlatformBackgroundDownloads(
  native: NativeDownloadsModule | null,
  fallback: BackgroundDownloads,
): BackgroundDownloads {
  if (!native) return fallback;
  return {
    enqueue: ({ id, url, filename, mediaType, mimeType }) => {
      const concreteMime = normalizeConcreteMediaMime(mimeType);
      if (!concreteMime) return Promise.reject(new Error('unsupported_mime'));
      const matchedMime = normalizeConcreteMediaMime(concreteMime, mediaType);
      if (!matchedMime) return Promise.reject(new Error('mime_mismatch'));
      return native.enqueue({ id, url, filename, mimeType: matchedMime });
    },
    cancel: (id) => native.cancel(id),
    async list() {
      return (await native.list()).map(toBackgroundEvent);
    },
    subscribe(listener) {
      const subscription = native.addListener('onDownloadEvent', () => listener());
      return () => subscription.remove();
    },
  };
}

export function createDefaultBackgroundDownloads(): BackgroundDownloads {
  const fallback = (require('../files/expo-background') as typeof import('../files/expo-background'))
    .expoActiveRuntimeDownloads;
  return createPlatformBackgroundDownloads(getOptionalNativeDownloads(), fallback);
}
