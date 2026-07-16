import type { MediaFiles } from '../downloads/ports';

export type MediaPermission = { granted: boolean; canAskAgain: boolean };

export interface MediaNativeDependencies {
  temporaryDirectoryUri: string;
  ensureTemporaryDirectory(): void;
  inspectFile(uri: string): { exists: boolean; size: number };
  readFileHeader(uri: string, maxBytes: number): Uint8Array;
  copyFile(sourceUri: string, destinationUri: string): Promise<void>;
  fingerprintFile(uri: string): Promise<string | null>;
  deleteIncomingStaging(uri: string): void;
  listTemporaryFiles(): string[];
  deleteFile(uri: string): void;
  getMediaPermission(): Promise<MediaPermission>;
  requestMediaPermission(): Promise<MediaPermission>;
  createAsset(uri: string): Promise<{ id: string }>;
  deleteAsset(assetUri: string): Promise<void>;
  resolveAssetUri(assetUri: string): Promise<string>;
  shareUri(uri: string): Promise<void>;
  openUri(uri: string): Promise<void>;
}

export class MediaFileError extends Error {
  constructor(
    public readonly reason: 'permission' | 'invalid_file' | 'storage' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'MediaFileError';
  }
}

function safeSegment(value: string, fallback: string, stripPath = false): string {
  const segment = (stripPath ? value.replace(/^.*[\\/]/u, '') : value)
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/^[.-]+|[.-]+$/gu, '');
  return segment || fallback;
}

function classifyNativeError(error: unknown): MediaFileError {
  if (error instanceof MediaFileError) return error;
  const message = error instanceof Error ? error.message : 'The media operation failed.';
  if (/(permission|denied|unauthori[sz]ed)/iu.test(message)) {
    return new MediaFileError('permission', 'Media library permission was denied.');
  }
  if (/(space|storage|disk full|quota)/iu.test(message)) {
    return new MediaFileError('storage', 'There is not enough device storage.');
  }
  return new MediaFileError('unknown', message);
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

type DetectedMediaFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'mp4' | 'mov' | 'webm' | 'mp3' | 'm4a' | 'ogg' | 'wav' | 'text' | 'unknown';

function ascii(bytes: Uint8Array, start = 0, end = bytes.length): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function detectedMediaFormat(bytes: Uint8Array): DetectedMediaFormat {
  const text = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 64))).trimStart().toLowerCase();
  if (text.startsWith('<!doctype') || text.startsWith('<html') || text.startsWith('{') || text.startsWith('[')) return 'text';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = ascii(bytes, 8, 12).toLowerCase();
    if (brand === 'qt  ') return 'mov';
    if (brand === 'm4a ' || brand === 'm4b ') return 'm4a';
    if (/^(?:iso.|mp4.|avc1|dash|m4v )$/u.test(brand)) return 'mp4';
    return 'unknown';
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && ascii(bytes).toLowerCase().includes('webm')) return 'webm';
  if (text.startsWith('id3')
    || startsWith(bytes, [0xff, 0xfb])
    || startsWith(bytes, [0xff, 0xf3])
    || startsWith(bytes, [0xff, 0xf2])) return 'mp3';
  if (text.startsWith('oggs')) return 'ogg';
  if (text.startsWith('riff') && text.slice(8, 12) === 'wave') return 'wav';
  return 'unknown';
}

function mediaTypeForFormat(format: DetectedMediaFormat): 'video' | 'audio' | 'image' | 'text' | 'unknown' {
  switch (format) {
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return 'image';
    case 'mp4':
    case 'mov':
    case 'webm':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'ogg':
    case 'wav':
      return 'audio';
    default:
      return format;
  }
}

const expectedFormatByMime: Readonly<Record<string, DetectedMediaFormat>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

function validateHeader(
  native: MediaNativeDependencies,
  uri: string,
  expected: 'video' | 'audio' | 'image',
  requireKnown = false,
  declaredMimeType?: string,
): void {
  const format = detectedMediaFormat(native.readFileHeader(uri, 512));
  const detected = mediaTypeForFormat(format);
  if (detected === 'text') throw new MediaFileError('invalid_file', 'The downloaded response is not media.');
  if (requireKnown && (detected === 'unknown' || (declaredMimeType && expectedFormatByMime[declaredMimeType] !== format))) {
    throw new MediaFileError('invalid_file', 'The shared file header is not a supported media format.');
  }
  if (detected !== 'unknown' && detected !== expected) {
    throw new MediaFileError('invalid_file', `The downloaded file does not match the expected ${expected} type.`);
  }
}

export function createMediaFiles(native: MediaNativeDependencies): MediaFiles {
  return {
    temporaryUri({ id, filename }) {
      native.ensureTemporaryDirectory();
      const safeId = safeSegment(id, 'download');
      const safeFilename = safeSegment(filename, 'media', true);
      return `${native.temporaryDirectoryUri.replace(/\/+$/u, '')}/${safeId}-${safeFilename}`;
    },

    async importIncoming(input) {
      try {
        if (!Number.isSafeInteger(input.declaredSizeBytes)
          || input.declaredSizeBytes <= 0
          || input.declaredSizeBytes > input.maxBytes) {
          throw new MediaFileError('invalid_file', 'Shared media size is outside the safe import limit.');
        }
        native.ensureTemporaryDirectory();
        await native.copyFile(input.sourceUri, input.temporaryUri);
        const inspection = native.inspectFile(input.temporaryUri);
        if (!inspection.exists) throw new MediaFileError('invalid_file', 'Shared media could not be copied.');
        if (inspection.size <= 0) throw new MediaFileError('invalid_file', 'Shared media is empty.');
        if (inspection.size > input.maxBytes) {
          throw new MediaFileError('invalid_file', 'Shared media exceeds the safe import size.');
        }
        if (inspection.size !== input.declaredSizeBytes) {
          throw new MediaFileError('invalid_file', 'Shared media changed while it was being imported.');
        }
        validateHeader(native, input.temporaryUri, input.mediaType, true, input.mimeType);
        const fingerprint = await native.fingerprintFile(input.temporaryUri);
        if (!fingerprint) throw new MediaFileError('invalid_file', 'Shared media could not be fingerprinted.');
        return {
          temporaryUri: input.temporaryUri,
          sizeBytes: inspection.size,
          fingerprint: `local:${fingerprint}:${inspection.size}`,
        };
      } catch (error) {
        try { native.deleteFile(input.temporaryUri); } catch { /* Best-effort partial import cleanup. */ }
        if (error instanceof MediaFileError) throw error;
        const classified = classifyNativeError(error);
        if (classified.reason === 'storage') throw classified;
        throw new MediaFileError('invalid_file', 'Shared media could not be accessed.');
      } finally {
        if (input.sourceOwnership === 'expo-sharing-staging') {
          try { native.deleteIncomingStaging(input.sourceUri); } catch { /* Best-effort SDK staging cleanup. */ }
        }
      }
    },

    async export(temporaryUri, input) {
      const inspection = native.inspectFile(temporaryUri);
      if (!inspection.exists) throw new MediaFileError('invalid_file', 'Temporary media is missing.');
      if (inspection.size <= 0) throw new MediaFileError('invalid_file', 'Temporary media is empty.');
      validateHeader(native, temporaryUri, input.mediaType);

      let permission = await native.getMediaPermission();
      if (!permission.granted && permission.canAskAgain) {
        permission = await native.requestMediaPermission();
      }
      if (!permission.granted) {
        throw new MediaFileError('permission', 'Media library permission was denied.');
      }

      try {
        const asset = await native.createAsset(temporaryUri);
        if (!asset.id) throw new MediaFileError('unknown', 'The device did not return a media asset ID.');
        return { assetUri: asset.id };
      } catch (error) {
        throw classifyNativeError(error);
      }
    },

    async removeTemporary(temporaryUri) {
      const inspection = native.inspectFile(temporaryUri);
      if (inspection.exists) native.deleteFile(temporaryUri);
    },

    async cleanupTemporary(preserveUris = []) {
      const preserve = new Set(preserveUris);
      const removed: string[] = [];
      const failed: Array<{ uri: string; message: string }> = [];
      for (const uri of native.listTemporaryFiles()) {
        if (preserve.has(uri)) continue;
        try {
          native.deleteFile(uri);
          removed.push(uri);
        } catch (error) {
          failed.push({ uri, message: error instanceof Error ? error.message : 'Temporary file cleanup failed.' });
        }
      }
      return { removed, failed };
    },

    async cleanupIncomingStaging(uris) {
      for (const uri of new Set(uris)) {
        try { native.deleteIncomingStaging(uri); } catch { /* Best-effort SDK staging cleanup. */ }
      }
    },

    async requestMediaPermission() {
      let permission = await native.getMediaPermission();
      if (!permission.granted && permission.canAskAgain) permission = await native.requestMediaPermission();
      return permission.granted ? 'granted' : 'denied';
    },

    async deleteAsset(assetUri) {
      await native.deleteAsset(assetUri);
    },

    async shareAsset(assetUri) {
      await native.shareUri(await native.resolveAssetUri(assetUri));
    },

    async openAsset(assetUri) {
      await native.openUri(await native.resolveAssetUri(assetUri));
    },
  };
}
