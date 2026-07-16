import { createMediaFiles, MediaFileError, type MediaNativeDependencies } from './media';

function createNative(overrides: Partial<MediaNativeDependencies> = {}): MediaNativeDependencies {
  return {
    temporaryDirectoryUri: 'file:///cache/imediasave',
    ensureTemporaryDirectory: jest.fn(),
    inspectFile: jest.fn().mockReturnValue({ exists: true, size: 128 }),
    readFileHeader: jest.fn().mockReturnValue(Uint8Array.from([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ])),
    copyFile: jest.fn().mockResolvedValue(undefined),
    fingerprintFile: jest.fn().mockResolvedValue('sha256-video'),
    deleteIncomingStaging: jest.fn(),
    listTemporaryFiles: jest.fn().mockReturnValue([]),
    deleteFile: jest.fn(),
    getMediaPermission: jest.fn().mockResolvedValue({ granted: true, canAskAgain: false }),
    requestMediaPermission: jest.fn().mockResolvedValue({ granted: true, canAskAgain: false }),
    createAsset: jest.fn().mockResolvedValue({ id: 'ph://asset-1' }),
    deleteAsset: jest.fn().mockResolvedValue(undefined),
    resolveAssetUri: jest.fn().mockResolvedValue('file:///library/clip.mp4'),
    shareUri: jest.fn().mockResolvedValue(undefined),
    openUri: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MediaFiles adapter', () => {
  test.each([
    ['image', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'sha256-image'],
    ['video', 'video/mp4', Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]), 'sha256-video'],
    ['audio', 'audio/mpeg', new TextEncoder().encode('ID3\u0004\u0000\u0000'), 'sha256-audio'],
  ] as const)('imports and fingerprints a bounded direct %s before export', async (mediaType, mimeType, header, fingerprint) => {
    const order: string[] = [];
    const native = createNative({
      copyFile: jest.fn().mockImplementation(async () => { order.push('copy'); }),
      inspectFile: jest.fn().mockImplementation(() => { order.push('inspect'); return { exists: true, size: 128 }; }),
      readFileHeader: jest.fn().mockImplementation(() => { order.push('header'); return header; }),
      fingerprintFile: jest.fn().mockImplementation(async () => { order.push('fingerprint'); return fingerprint; }),
    });
    const files = createMediaFiles(native);

    await expect(files.importIncoming!({
      sourceUri: `content://share/item-${mediaType}`,
      temporaryUri: `file:///cache/item.${mediaType}`,
      filename: `item.${mediaType}`,
      mediaType,
      mimeType,
      declaredSizeBytes: 128,
      maxBytes: 1024,
      sourceOwnership: 'external',
    })).resolves.toEqual({
      temporaryUri: `file:///cache/item.${mediaType}`,
      sizeBytes: 128,
      fingerprint: `local:${fingerprint}:128`,
    });
    expect(order).toEqual(['copy', 'inspect', 'header', 'fingerprint']);
    expect(native.readFileHeader).toHaveBeenCalledWith(`file:///cache/item.${mediaType}`, 512);
  });

  test.each([
    ['JPEG', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'image'],
    ['PNG', 'image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image'],
    ['GIF', 'image/gif', new TextEncoder().encode('GIF89a'), 'image'],
    ['WebP', 'image/webp', new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '), 'image'],
    ['MP4', 'video/mp4', Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]), 'video'],
    ['MOV', 'video/quicktime', Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]), 'video'],
    ['WebM', 'video/webm', Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]), 'video'],
  ] as const)('validates exact direct %s signatures', async (_label, mimeType, header, mediaType) => {
    const files = createMediaFiles(createNative({
      readFileHeader: jest.fn().mockReturnValue(header),
      fingerprintFile: jest.fn().mockResolvedValue('sha256'),
    }));
    await expect(files.importIncoming!({
      sourceUri: 'content://share/item', temporaryUri: 'file:///cache/item', filename: 'item',
      mediaType, mimeType, declaredSizeBytes: 128, maxBytes: 1024, sourceOwnership: 'external',
    })).resolves.toMatchObject({ fingerprint: 'local:sha256:128' });
  });

  test('rejects a declared MIME/signature mismatch even within the same media family', async () => {
    const files = createMediaFiles(createNative({
      readFileHeader: jest.fn().mockReturnValue(
        Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]),
      ),
    }));
    await expect(files.importIncoming!({
      sourceUri: 'content://share/movie', temporaryUri: 'file:///cache/movie', filename: 'movie.mp4',
      mediaType: 'video', mimeType: 'video/mp4', declaredSizeBytes: 128, maxBytes: 1024,
      sourceOwnership: 'external',
    })).rejects.toMatchObject({ reason: 'invalid_file' });
  });

  test('always removes known Expo staging after copy or rejection but never external sources', async () => {
    const success = createNative({ fingerprintFile: jest.fn().mockResolvedValue('sha256') });
    await createMediaFiles(success).importIncoming!({
      sourceUri: 'file:///expo-cache/photo.jpg', temporaryUri: 'file:///cache/photo.jpg', filename: 'photo.jpg',
      mediaType: 'video', mimeType: 'video/mp4', declaredSizeBytes: 128, maxBytes: 1024,
      sourceOwnership: 'expo-sharing-staging',
    });
    expect(success.deleteIncomingStaging).toHaveBeenCalledWith('file:///expo-cache/photo.jpg');

    const rejected = createNative({ copyFile: jest.fn().mockRejectedValue(new Error('denied')) });
    await expect(createMediaFiles(rejected).importIncoming!({
      sourceUri: 'file:///expo-cache/bad.mp4', temporaryUri: 'file:///cache/bad.mp4', filename: 'bad.mp4',
      mediaType: 'video', mimeType: 'video/mp4', declaredSizeBytes: 128, maxBytes: 1024,
      sourceOwnership: 'expo-sharing-staging',
    })).rejects.toBeDefined();
    expect(rejected.deleteIncomingStaging).toHaveBeenCalledWith('file:///expo-cache/bad.mp4');

    const external = createNative({ copyFile: jest.fn().mockRejectedValue(new Error('denied')) });
    await expect(createMediaFiles(external).importIncoming!({
      sourceUri: 'content://user/photo', temporaryUri: 'file:///cache/external', filename: 'photo.jpg',
      mediaType: 'image', mimeType: 'image/jpeg', declaredSizeBytes: 128, maxBytes: 1024,
      sourceOwnership: 'external',
    })).rejects.toBeDefined();
    expect(external.deleteIncomingStaging).not.toHaveBeenCalled();
  });

  test('never deletes native queue staging during direct import success or failure', async () => {
    const success = createNative({
      readFileHeader: jest.fn().mockReturnValue(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])),
      fingerprintFile: jest.fn().mockResolvedValue('sha256-native'),
    });
    await createMediaFiles(success).importIncoming!({
      sourceUri: 'file:///cache/imediasave-shares/batch/photo.jpg',
      temporaryUri: 'file:///cache/photo.jpg',
      filename: 'photo.jpg', mediaType: 'image', mimeType: 'image/jpeg',
      declaredSizeBytes: 128, maxBytes: 1024, sourceOwnership: 'native-share-queue',
    });
    expect(success.deleteIncomingStaging).not.toHaveBeenCalled();

    const failure = createNative({ copyFile: jest.fn().mockRejectedValue(new Error('copy failed')) });
    await expect(createMediaFiles(failure).importIncoming!({
      sourceUri: 'file:///cache/imediasave-shares/batch/bad.jpg',
      temporaryUri: 'file:///cache/bad.jpg',
      filename: 'bad.jpg', mediaType: 'image', mimeType: 'image/jpeg',
      declaredSizeBytes: 128, maxBytes: 1024, sourceOwnership: 'native-share-queue',
    })).rejects.toBeDefined();
    expect(failure.deleteIncomingStaging).not.toHaveBeenCalled();
  });

  test.each([
    ['inaccessible source', { copyFile: jest.fn().mockRejectedValue(new Error('content URI denied')) }],
    ['empty import', { inspectFile: jest.fn().mockReturnValue({ exists: true, size: 0 }) }],
    ['oversized import', { inspectFile: jest.fn().mockReturnValue({ exists: true, size: 2048 }) }],
    ['unknown header', { readFileHeader: jest.fn().mockReturnValue(Uint8Array.from([1, 2, 3, 4])) }],
    ['MIME/header mismatch', { readFileHeader: jest.fn().mockReturnValue(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])) }],
    ['missing fingerprint', { fingerprintFile: jest.fn().mockResolvedValue(null) }],
  ])('rejects and cleans a direct %s', async (_label, overrides) => {
    const native = createNative(overrides as Partial<MediaNativeDependencies>);
    const files = createMediaFiles(native);

    await expect(files.importIncoming!({
      sourceUri: 'content://share/item',
      temporaryUri: 'file:///cache/item.mp4',
      filename: 'item.mp4',
      mediaType: 'video',
      mimeType: 'video/mp4',
      declaredSizeBytes: 128,
      maxBytes: 1024,
    })).rejects.toMatchObject({ reason: 'invalid_file' });
    expect(native.deleteFile).toHaveBeenCalledWith('file:///cache/item.mp4');
    expect(native.createAsset).not.toHaveBeenCalled();
  });

  test('rejects a copied file whose actual size differs from resolved share metadata', async () => {
    const native = createNative({
      inspectFile: jest.fn().mockReturnValue({ exists: true, size: 129 }),
    });

    await expect(createMediaFiles(native).importIncoming!({
      sourceUri: 'content://share/item', temporaryUri: 'file:///cache/item.mp4', filename: 'item.mp4',
      mediaType: 'video', mimeType: 'video/mp4', declaredSizeBytes: 128, maxBytes: 1024,
    })).rejects.toMatchObject({ reason: 'invalid_file' });
    expect(native.deleteFile).toHaveBeenCalledWith('file:///cache/item.mp4');
  });

  test('preserves a typed storage failure while cleaning a partial direct import', async () => {
    const native = createNative({
      copyFile: jest.fn().mockRejectedValue(new Error('disk full')),
    });

    await expect(createMediaFiles(native).importIncoming!({
      sourceUri: 'content://share/item', temporaryUri: 'file:///cache/item.mp4', filename: 'item.mp4',
      mediaType: 'video', mimeType: 'video/mp4', declaredSizeBytes: 128, maxBytes: 1024,
    })).rejects.toMatchObject({ reason: 'storage' });
    expect(native.deleteFile).toHaveBeenCalledWith('file:///cache/item.mp4');
  });

  test('creates a stable sanitized temporary destination', () => {
    const native = createNative();
    const files = createMediaFiles(native);

    expect(files.temporaryUri({ id: 'job/one', filename: '../Summer Reel.mp4' }))
      .toBe('file:///cache/imediasave/job-one-Summer-Reel.mp4');
    expect(native.ensureTemporaryDirectory).toHaveBeenCalledTimes(1);
  });

  test('validates a non-empty temporary file before exporting its final asset ID', async () => {
    const order: string[] = [];
    const native = createNative({
      inspectFile: jest.fn().mockImplementation(() => {
        order.push('inspect');
        return { exists: true, size: 128 };
      }),
      createAsset: jest.fn().mockImplementation(async () => {
        order.push('asset');
        return { id: 'ph://asset-1' };
      }),
    });

    await expect(createMediaFiles(native).export('file:///cache/clip.mp4', {
      filename: 'clip.mp4',
      mediaType: 'video',
    })).resolves.toEqual({ assetUri: 'ph://asset-1' });
    expect(order).toEqual(['inspect', 'asset']);
  });

  test('maps denied media permission without deleting the completed temporary file', async () => {
    const native = createNative({
      getMediaPermission: jest.fn().mockResolvedValue({ granted: false, canAskAgain: false }),
    });

    await expect(createMediaFiles(native).export('file:///cache/clip.mp4', {
      filename: 'clip.mp4',
      mediaType: 'video',
    })).rejects.toMatchObject<Partial<MediaFileError>>({ reason: 'permission' });
    expect(native.createAsset).not.toHaveBeenCalled();
    expect(native.deleteFile).not.toHaveBeenCalled();
  });

  test.each([
    ['HTML', new TextEncoder().encode('<!doctype html><title>Error</title>'), 'video'],
    ['JSON', new TextEncoder().encode('{"error":"expired"}'), 'video'],
    ['image signature for video', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'video'],
  ] as const)('rejects bounded %s payload validation before media permission', async (_label, header, mediaType) => {
    const native = createNative({ readFileHeader: jest.fn().mockReturnValue(header) });

    await expect(createMediaFiles(native).export('file:///cache/clip.mp4', {
      filename: 'clip.mp4', mediaType,
    })).rejects.toMatchObject({ reason: 'invalid_file' });
    expect(native.readFileHeader).toHaveBeenCalledWith('file:///cache/clip.mp4', 512);
    expect(native.getMediaPermission).not.toHaveBeenCalled();
  });

  test('cleans orphan temporary files while preserving active recovery files and reports retryable failures', async () => {
    const native = createNative({
      listTemporaryFiles: jest.fn().mockReturnValue(['file:///cache/keep.mp4', 'file:///cache/remove.mp4', 'file:///cache/fail.mp4']),
      deleteFile: jest.fn().mockImplementation((uri: string) => {
        if (uri.endsWith('/fail.mp4')) throw new Error('busy');
      }),
    });

    await expect(createMediaFiles(native).cleanupTemporary(['file:///cache/keep.mp4'])).resolves.toEqual({
      removed: ['file:///cache/remove.mp4'],
      failed: [{ uri: 'file:///cache/fail.mp4', message: 'busy' }],
    });
  });

  test.each([
    [{ exists: false, size: 0 }, 'Temporary media is missing.'],
    [{ exists: true, size: 0 }, 'Temporary media is empty.'],
  ])('rejects invalid temporary media before requesting permission', async (inspection, message) => {
    const native = createNative({ inspectFile: jest.fn().mockReturnValue(inspection) });

    await expect(createMediaFiles(native).export('file:///cache/clip.mp4', {
      filename: 'clip.mp4',
      mediaType: 'video',
    })).rejects.toEqual(new MediaFileError('invalid_file', message));
    expect(native.getMediaPermission).not.toHaveBeenCalled();
  });

  test('cleans temporary files and resolves final assets for delete, share, and open', async () => {
    const native = createNative();
    const files = createMediaFiles(native);

    await files.removeTemporary('file:///cache/clip.mp4');
    await files.deleteAsset('ph://asset-1');
    await files.shareAsset('ph://asset-1');
    await files.openAsset('ph://asset-1');

    expect(native.deleteFile).toHaveBeenCalledWith('file:///cache/clip.mp4');
    expect(native.deleteAsset).toHaveBeenCalledWith('ph://asset-1');
    expect(native.resolveAssetUri).toHaveBeenCalledTimes(2);
    expect(native.shareUri).toHaveBeenCalledWith('file:///library/clip.mp4');
    expect(native.openUri).toHaveBeenCalledWith('file:///library/clip.mp4');
  });
});
