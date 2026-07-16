import type { ResolvedSharePayload, SharePayload } from 'expo-sharing';

import { MAX_DIRECT_MEDIA_BYTES, type DirectMediaInput } from '../downloads/types';
import { normalizeSharedUrl } from './url';

export const MAX_INCOMING_MEDIA_ITEMS = 10;
export const MAX_INCOMING_MEDIA_BYTES = MAX_DIRECT_MEDIA_BYTES;
export const MAX_INCOMING_TOTAL_BYTES = 1024 * 1024 * 1024;
export const MAX_INCOMING_TEXT_CHARS = 8_192;
export const MAX_INCOMING_NAME_CHARS = 128;
const MAX_INCOMING_ORIGINAL_NAME_CHARS = 1_024;
const MAX_INCOMING_URI_CHARS = 8_192;
const MAX_INCOMING_MIME_CHARS = 128;

const allowedImageMimeTypes = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const allowedVideoMimeTypes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export type IncomingShareRejectionCode =
  | 'duplicate_item'
  | 'empty_payload'
  | 'inaccessible_file'
  | 'mixed_payload'
  | 'multiple_urls'
  | 'private_url'
  | 'resolution_failed'
  | 'too_large'
  | 'too_many_items'
  | 'unsupported_mime';

export type NormalizedIncomingShare =
  | { kind: 'pending' }
  | { kind: 'empty' }
  | { kind: 'url'; key: string; url: string }
  | {
      kind: 'media';
      key: string;
      items: DirectMediaInput[];
      requiresSelection: boolean;
    }
  | {
      kind: 'rejected';
      key: string;
      code: IncomingShareRejectionCode;
      message: string;
      stagingUris: string[];
    };

export type IncomingShareSnapshot = {
  sharedPayloads: readonly SharePayload[];
  resolvedSharedPayloads: readonly ResolvedSharePayload[];
  isResolving: boolean;
  error: Error | null;
  sourceOwnership?: 'native-share-queue';
  sourceKey?: string;
};

function sourceScopedKey(snapshot: IncomingShareSnapshot, key: string): string {
  const sourceKey = snapshot.sourceKey?.slice(0, 256);
  return sourceKey ? `source:${canonical([sourceKey, key])}` : key;
}

function canonical(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('|');
}

function boundedSnapshotKey(snapshot: IncomingShareSnapshot, code: IncomingShareRejectionCode): string {
  const safeRaw = snapshot.sharedPayloads.length <= MAX_INCOMING_MEDIA_ITEMS
    ? snapshot.sharedPayloads.flatMap(({ mimeType = '', shareType, value }) => (
      value.length <= MAX_INCOMING_TEXT_CHARS && mimeType.length <= MAX_INCOMING_MIME_CHARS
        ? [shareType, mimeType, value]
        : []
    ))
    : [];
  return sourceScopedKey(snapshot, `rejected:${code}:${canonical([
    String(snapshot.sharedPayloads.length),
    String(snapshot.resolvedSharedPayloads.length),
    ...safeRaw,
  ])}`);
}

function isFileUri(value: string | null | undefined): value is string {
  if (!value || value.length > MAX_INCOMING_URI_CHARS) return false;
  try { return new URL(value).protocol === 'file:'; } catch { return false; }
}

function stagingUris(snapshot: IncomingShareSnapshot): string[] {
  if (snapshot.sourceOwnership === 'native-share-queue') return [];
  const uris = new Set<string>();
  for (const payload of snapshot.sharedPayloads.slice(0, MAX_INCOMING_MEDIA_ITEMS)) {
    if (payload.shareType !== 'text' && payload.shareType !== 'url' && isFileUri(payload.value)) uris.add(payload.value);
  }
  for (const payload of snapshot.resolvedSharedPayloads.slice(0, MAX_INCOMING_MEDIA_ITEMS)) {
    if (payload.shareType !== 'text' && payload.shareType !== 'url' && isFileUri(payload.contentUri)) uris.add(payload.contentUri);
  }
  return [...uris];
}

function rejected(
  snapshot: IncomingShareSnapshot,
  code: IncomingShareRejectionCode,
  message: string,
): NormalizedIncomingShare {
  return { kind: 'rejected', key: boundedSnapshotKey(snapshot, code), code, message, stagingUris: stagingUris(snapshot) };
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [first, second, third] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224;
}

function isPublicHttpUrl(value: string): string | null {
  const normalized = normalizeSharedUrl(value);
  if (!normalized) return null;
  const parsed = new URL(normalized.url);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  if (!hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.lan')
    || hostname === '::1'
    || hostname === '::'
    || hostname.startsWith('fc')
    || hostname.startsWith('fd')
    || hostname.startsWith('fe8')
    || hostname.startsWith('fe9')
    || hostname.startsWith('fea')
    || hostname.startsWith('feb')
    || hostname.startsWith('2001:db8:')
    || /^::ffff:(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\./u.test(hostname)
    || (!hostname.includes('.') && !hostname.includes(':'))
    || isPrivateIpv4(hostname)) return null;
  return normalized.url;
}

function findSharedUrls(value: string): string[] {
  return [...value.matchAll(/https?:\/\/[^\s<>"'`]+/giu)]
    .map((match) => match[0]);
}

function mediaTypeForMime(mimeType: string): 'image' | 'video' | null {
  if (allowedImageMimeTypes.has(mimeType)) return 'image';
  if (allowedVideoMimeTypes.has(mimeType)) return 'video';
  return null;
}

function inferredFilename(uri: string): string | null {
  try {
    const value = decodeURIComponent(uri.split(/[?#]/u)[0]?.split('/').pop() ?? '').trim();
    return value || null;
  } catch {
    return null;
  }
}

const extensionsForMime: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
  'video/webm': ['webm'],
};

function safeFilename(value: string, mimeType: string): string | null {
  if (!value || value.length > MAX_INCOMING_ORIGINAL_NAME_CHARS) return null;
  const segment = value.replace(/^.*[\\/]/u, '').trim();
  if (!segment) return null;
  const allowedExtensions = extensionsForMime[mimeType];
  if (!allowedExtensions) return null;
  const suppliedExtension = segment.match(/\.([a-zA-Z0-9]+)$/u)?.[1]?.toLowerCase();
  const extension = suppliedExtension && allowedExtensions.includes(suppliedExtension)
    ? suppliedExtension
    : allowedExtensions[0];
  const withoutExtension = suppliedExtension ? segment.slice(0, -(suppliedExtension.length + 1)) : segment;
  const stem = withoutExtension
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/^[.-]+|[.-]+$/gu, '') || 'shared-media';
  const suffix = `.${extension}`;
  const maxStemChars = MAX_INCOMING_NAME_CHARS - suffix.length;
  return `${stem.slice(0, maxStemChars).replace(/[.-]+$/gu, '') || 'shared-media'}${suffix}`;
}

export function normalizeIncomingShare(snapshot: IncomingShareSnapshot): NormalizedIncomingShare {
  if (snapshot.isResolving) return { kind: 'pending' };
  if (snapshot.sharedPayloads.length > MAX_INCOMING_MEDIA_ITEMS
    || snapshot.resolvedSharedPayloads.length > MAX_INCOMING_MEDIA_ITEMS) {
    return rejected(snapshot, 'too_many_items', `Share no more than ${MAX_INCOMING_MEDIA_ITEMS} items at once.`);
  }
  if (snapshot.sharedPayloads.some((payload) => (
    payload.value.length > MAX_INCOMING_TEXT_CHARS
    || (payload.mimeType?.length ?? 0) > MAX_INCOMING_MIME_CHARS
  )) || snapshot.resolvedSharedPayloads.some((payload) => (
    (payload.contentUri?.length ?? 0) > MAX_INCOMING_URI_CHARS
    || (payload.originalName?.length ?? 0) > MAX_INCOMING_ORIGINAL_NAME_CHARS
    || (payload.contentMimeType?.length ?? 0) > MAX_INCOMING_MIME_CHARS
  ))) {
    return rejected(snapshot, 'too_large', 'Shared metadata exceeds the safe processing limit.');
  }
  if (snapshot.error) {
    return rejected(snapshot, 'resolution_failed', 'The shared content could not be opened.');
  }
  if (snapshot.sharedPayloads.length === 0) return { kind: 'empty' };

  const textPayloads = snapshot.sharedPayloads.filter(({ shareType }) => shareType === 'text' || shareType === 'url');
  const mediaPayloads = snapshot.sharedPayloads.filter(({ shareType }) => shareType !== 'text' && shareType !== 'url');
  if (textPayloads.length && mediaPayloads.length) {
    return rejected(snapshot, 'mixed_payload', 'Share either one public link or media files, not both.');
  }

  if (textPayloads.length) {
    if (textPayloads.length !== 1 || snapshot.sharedPayloads.length !== 1) {
      return rejected(snapshot, 'multiple_urls', 'Share exactly one public link at a time.');
    }
    const textMimeType = textPayloads[0].mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? 'text/plain';
    if (textMimeType !== 'text/plain' && textMimeType !== 'text/html') {
      return rejected(snapshot, 'unsupported_mime', 'Only shared URL or text payloads are supported.');
    }
    const urls = findSharedUrls(textPayloads[0].value);
    if (textPayloads[0].shareType === 'url' && urls.length === 0) urls.push(textPayloads[0].value.trim());
    if (urls.length !== 1) {
      return rejected(snapshot, urls.length ? 'multiple_urls' : 'empty_payload', 'Share exactly one public HTTP(S) link.');
    }
    const url = isPublicHttpUrl(urls[0]);
    if (!url) return rejected(snapshot, 'private_url', 'Only public HTTP(S) links can be downloaded.');
    return { kind: 'url', key: sourceScopedKey(snapshot, `url:${url}`), url };
  }

  if (mediaPayloads.length > MAX_INCOMING_MEDIA_ITEMS) {
    return rejected(snapshot, 'too_many_items', `Share no more than ${MAX_INCOMING_MEDIA_ITEMS} media items at once.`);
  }
  if (snapshot.resolvedSharedPayloads.length !== mediaPayloads.length) {
    return rejected(snapshot, 'inaccessible_file', 'Every shared media item must be accessible.');
  }
  for (const payload of mediaPayloads) {
    const rawMimeType = payload.mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    const rawMediaType = mediaTypeForMime(rawMimeType);
    if ((payload.shareType !== 'image' && payload.shareType !== 'video')
      || rawMediaType !== payload.shareType) {
      return rejected(snapshot, 'unsupported_mime', 'Only supported image and video formats can be saved.');
    }
  }

  const items: DirectMediaInput[] = [];
  const identities = new Set<string>();
  let totalSize = 0;
  for (const payload of snapshot.resolvedSharedPayloads) {
    const mimeType = payload.contentMimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    const mediaType = mediaTypeForMime(mimeType);
    if (!mediaType || (payload.contentType !== 'image' && payload.contentType !== 'video')) {
      return rejected(snapshot, 'unsupported_mime', 'Only supported image and video formats can be saved.');
    }
    if (payload.contentType !== mediaType) {
      return rejected(snapshot, 'unsupported_mime', 'The shared MIME type does not match its media type.');
    }
    const sourceUri = payload.contentUri;
    const sizeBytes = payload.contentSize;
    const rawFilename = payload.originalName?.trim() || (sourceUri ? inferredFilename(sourceUri) : null);
    const filename = rawFilename ? safeFilename(rawFilename, mimeType) : null;
    let localScheme = false;
    if (sourceUri) {
      try {
        const protocol = new URL(sourceUri).protocol;
        localScheme = protocol === 'content:' || protocol === 'file:';
      } catch {
        localScheme = false;
      }
    }
    if (!sourceUri || !localScheme || !filename || sizeBytes === null || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      return rejected(snapshot, 'inaccessible_file', 'Shared media is missing accessible file metadata.');
    }
    if (sizeBytes > MAX_INCOMING_MEDIA_BYTES) {
      return rejected(snapshot, 'too_large', 'A shared media item exceeds the safe import size.');
    }
    totalSize += sizeBytes;
    if (totalSize > MAX_INCOMING_TOTAL_BYTES) {
      return rejected(snapshot, 'too_large', 'The shared media set exceeds the safe import size.');
    }
    const identity = `${sourceUri}\n${mimeType}\n${sizeBytes}`;
    if (identities.has(identity)) {
      return rejected(snapshot, 'duplicate_item', 'The same media item was shared more than once.');
    }
    identities.add(identity);
    items.push({
      sourceUri, filename, mediaType, mimeType, sizeBytes,
      sourceOwnership: snapshot.sourceOwnership
        ?? (isFileUri(sourceUri) ? 'expo-sharing-staging' : 'external'),
    });
  }

  if (!items.length) return rejected(snapshot, 'empty_payload', 'No supported shared media was found.');
  return {
    kind: 'media',
    key: sourceScopedKey(snapshot, `media:${canonical([...identities].sort())}`),
    items,
    requiresSelection: items.length > 1,
  };
}
