import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import { createMediaFiles, type MediaNativeDependencies } from './media';
import { Sha256 } from './sha256';

const temporaryDirectory = new Directory(Paths.cache, 'imediasave');
const CRYPTO_BUFFER_LIMIT = 8 * 1024 * 1024;
const HASH_CHUNK_BYTES = 1024 * 1024;

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isWithin(directoryUri: string | undefined, fileUri: string): boolean {
  if (!directoryUri) return false;
  const root = directoryUri.replace(/\/+$/u, '');
  return fileUri === root || fileUri.startsWith(`${root}/`);
}

const native: MediaNativeDependencies = {
  temporaryDirectoryUri: temporaryDirectory.uri,
  ensureTemporaryDirectory() {
    temporaryDirectory.create({ idempotent: true, intermediates: true });
  },
  inspectFile(uri) {
    const file = new File(uri);
    return { exists: file.exists, size: file.size };
  },
  readFileHeader(uri, maxBytes) {
    const handle = new File(uri).open();
    try {
      return handle.readBytes(Math.min(maxBytes, handle.size ?? maxBytes));
    } finally {
      handle.close();
    }
  },
  async copyFile(sourceUri, destinationUri) {
    await new File(sourceUri).copy(new File(destinationUri), { overwrite: true });
  },
  async fingerprintFile(uri) {
    const file = new File(uri);
    if (!file.exists || file.size <= 0) return null;
    if (file.size <= CRYPTO_BUFFER_LIMIT) {
      return hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes()));
    }
    const hasher = new Sha256();
    const handle = file.open();
    try {
      let remaining = file.size;
      while (remaining > 0) {
        const chunk = handle.readBytes(Math.min(HASH_CHUNK_BYTES, remaining));
        if (!chunk.length) return null;
        hasher.update(chunk);
        remaining -= chunk.length;
      }
      return hasher.hex();
    } finally {
      handle.close();
    }
  },
  deleteIncomingStaging(uri) {
    const appGroupUri = Paths.appleSharedContainers['group.com.imediasave.app']?.uri;
    if (!isWithin(Paths.cache.uri, uri) && !isWithin(appGroupUri, uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  },
  listTemporaryFiles() {
    temporaryDirectory.create({ idempotent: true, intermediates: true });
    return temporaryDirectory.list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => file.uri);
  },
  deleteFile(uri) {
    new File(uri).delete();
  },
  getMediaPermission: () => MediaLibrary.getPermissionsAsync(true),
  requestMediaPermission: () => MediaLibrary.requestPermissionsAsync(true),
  async createAsset(uri) {
    return MediaLibrary.Asset.create(uri);
  },
  async deleteAsset(assetUri) {
    await new MediaLibrary.Asset(assetUri).delete();
  },
  resolveAssetUri: (assetUri) => new MediaLibrary.Asset(assetUri).getUri(),
  async shareUri(uri) {
    if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
    await Sharing.shareAsync(uri);
  },
  async openUri(uri) {
    await Linking.openURL(uri);
  },
};

export const expoMediaFiles = createMediaFiles(native);
