import type { MediaType } from '../downloads/types';

export const CONCRETE_MEDIA_MIME_TYPES = {
  'audio/mpeg': { extension: 'mp3', mediaType: 'audio' },
  'audio/mp4': { extension: 'm4a', mediaType: 'audio' },
  'audio/ogg': { extension: 'ogg', mediaType: 'audio' },
  'audio/wav': { extension: 'wav', mediaType: 'audio' },
  'image/gif': { extension: 'gif', mediaType: 'image' },
  'image/jpeg': { extension: 'jpg', mediaType: 'image' },
  'image/png': { extension: 'png', mediaType: 'image' },
  'image/webp': { extension: 'webp', mediaType: 'image' },
  'video/mp4': { extension: 'mp4', mediaType: 'video' },
  'video/quicktime': { extension: 'mov', mediaType: 'video' },
  'video/webm': { extension: 'webm', mediaType: 'video' },
} as const satisfies Record<string, { extension: string; mediaType: MediaType }>;

export type ConcreteMediaMimeType = keyof typeof CONCRETE_MEDIA_MIME_TYPES;

const mimeByExtension: Readonly<Record<string, ConcreteMediaMimeType>> = {
  gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
};

export function normalizeConcreteMediaMime(
  value: unknown,
  expectedMediaType?: MediaType,
): ConcreteMediaMimeType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized || !(normalized in CONCRETE_MEDIA_MIME_TYPES)) return null;
  const mime = normalized as ConcreteMediaMimeType;
  return !expectedMediaType || CONCRETE_MEDIA_MIME_TYPES[mime].mediaType === expectedMediaType
    ? mime
    : null;
}

function extensionFrom(value: string): string | null {
  try {
    const path = value.includes('://') ? new URL(value).pathname : value;
    return decodeURIComponent(path).match(/\.([a-zA-Z0-9]+)$/u)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function inferConcreteMediaMime(input: {
  declaredMimeType?: unknown;
  filename: string;
  mediaType: MediaType;
  url?: string;
}): ConcreteMediaMimeType | null {
  if (input.declaredMimeType !== undefined) {
    return normalizeConcreteMediaMime(input.declaredMimeType, input.mediaType);
  }
  for (const value of [input.filename, input.url]) {
    if (!value) continue;
    const extension = extensionFrom(value);
    const mime = extension ? mimeByExtension[extension] : undefined;
    if (mime && CONCRETE_MEDIA_MIME_TYPES[mime].mediaType === input.mediaType) return mime;
  }
  return null;
}

export function filenameForConcreteMediaMime(
  filename: string,
  mimeType: ConcreteMediaMimeType,
): string {
  const leaf = filename.replace(/^.*[\\/]/u, '').trim();
  const stem = leaf.replace(/\.[a-zA-Z0-9]+$/u, '').trim() || 'media';
  return `${stem}.${CONCRETE_MEDIA_MIME_TYPES[mimeType].extension}`;
}
