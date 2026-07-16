import type { ResolvedSharePayload, SharePayload } from 'expo-sharing';

import {
  MAX_INCOMING_NAME_CHARS,
  MAX_INCOMING_MEDIA_ITEMS,
  MAX_INCOMING_TEXT_CHARS,
  normalizeIncomingShare,
} from './incoming';

function raw(
  value: string,
  shareType: SharePayload['shareType'],
  mimeType?: string,
): SharePayload {
  return { value, shareType, ...(mimeType ? { mimeType } : {}) };
}

function resolvedMedia(input: {
  uri: string | null;
  type: 'image' | 'video' | 'file';
  mimeType: string | null;
  name: string | null;
  size: number | null;
}): ResolvedSharePayload {
  return {
    value: input.uri ?? '',
    shareType: input.type,
    mimeType: input.mimeType ?? undefined,
    contentUri: input.uri,
    contentType: input.type,
    contentMimeType: input.mimeType,
    originalName: input.name,
    contentSize: input.size,
  } as ResolvedSharePayload;
}

const idle = { isResolving: false, error: null } as const;

test('normalizes exactly one public HTTP(S) URL from shared text', () => {
  const result = normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw('Save this https://example.com/watch/one', 'text', 'text/plain')],
    resolvedSharedPayloads: [{
      value: 'Save this https://example.com/watch/one', shareType: 'text', mimeType: 'text/plain',
      contentUri: null, contentType: 'text', contentMimeType: 'text/plain', originalName: null, contentSize: null,
    }],
  });

  expect(result).toMatchObject({ kind: 'url', url: 'https://example.com/watch/one' });
  expect(result.kind === 'url' ? result.key : '').toContain('url:');
});

test('accepts the real SDK 57 iOS URL shape with text/html only as strict URL text', () => {
  const value = 'https://example.com/watch/ios-share';
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(value, 'url', 'text/html')],
    resolvedSharedPayloads: [{
      value, shareType: 'url', mimeType: 'text/html', contentUri: value,
      contentType: 'website', contentMimeType: 'text/html', originalName: 'ios-share.html', contentSize: 321,
    }],
  })).toEqual({ kind: 'url', key: `url:${value}`, url: value });
});

test('rejects HTML files even though SDK 57 URL payloads may use text/html', () => {
  const uri = 'file:///group/unsafe.html';
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(uri, 'file', 'text/html')],
    resolvedSharedPayloads: [resolvedMedia({
      uri, type: 'file', mimeType: 'text/html', name: 'unsafe.html', size: 321,
    })],
  })).toMatchObject({
    kind: 'rejected', code: 'unsupported_mime', stagingUris: [uri],
  });
});

test('bounds raw text and payload count before URL extraction or consumer key creation', () => {
  const tooLong = `https://example.com/${'x'.repeat(MAX_INCOMING_TEXT_CHARS)}`;
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(tooLong, 'url', 'text/plain')],
    resolvedSharedPayloads: [],
  })).toMatchObject({ kind: 'rejected', code: 'too_large' });

  const payloads = Array.from({ length: MAX_INCOMING_MEDIA_ITEMS + 1 }, (_, index) => (
    raw(`content://shares/${index}`, 'image', 'image/jpeg')
  ));
  expect(normalizeIncomingShare({ ...idle, sharedPayloads: payloads, resolvedSharedPayloads: [] }))
    .toMatchObject({ kind: 'rejected', code: 'too_many_items' });
});

test.each([
  'http://localhost/video',
  'http://127.0.0.1/video',
  'https://10.0.0.8/video',
  'https://192.168.1.4/video',
  'https://[::1]/video',
  'https://100.64.0.1/video',
  'https://198.51.100.8/video',
  'https://intranet/video',
])('rejects non-public shared URL %s', (value) => {
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(value, 'url', 'text/plain')],
    resolvedSharedPayloads: [{
      value, shareType: 'url', mimeType: 'text/plain', contentUri: value,
      contentType: 'website', contentMimeType: 'text/html', originalName: null, contentSize: null,
    }],
  })).toMatchObject({ kind: 'rejected', code: 'private_url' });
});

test.each([
  ['image', 'content://shares/photo', 'image/jpeg', 'photo.jpg'],
  ['video', 'file:///group/clip.mp4', 'video/mp4', 'clip.mp4'],
] as const)('accepts an accessible resolved %s with bounded metadata', (type, uri, mimeType, name) => {
  const result = normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(uri, type, mimeType)],
    resolvedSharedPayloads: [resolvedMedia({ uri, type, mimeType, name, size: 4096 })],
  });

  expect(result).toMatchObject({
    kind: 'media',
    requiresSelection: false,
    items: [{ sourceUri: uri, mediaType: type, mimeType, filename: name, sizeBytes: 4096 }],
  });
});

test('marks only SDK file staging as owned and clamps path-like names without losing the MIME extension', () => {
  const uri = 'file:///group/photo-stage';
  const result = normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(uri, 'image', 'image/jpeg')],
    resolvedSharedPayloads: [resolvedMedia({
      uri,
      type: 'image',
      mimeType: 'image/jpeg',
      name: `../../${'summer-'.repeat(40)}photo.jpeg`,
      size: 4096,
    })],
  });

  expect(result).toMatchObject({
    kind: 'media',
    items: [{ sourceOwnership: 'expo-sharing-staging' }],
  });
  const filename = result.kind === 'media' ? result.items[0].filename : '';
  expect(filename.length).toBeLessThanOrEqual(MAX_INCOMING_NAME_CHARS);
  expect(filename).toMatch(/\.jpeg$/u);
  expect(filename).not.toContain('/');

  const external = normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw('content://shares/photo', 'image', 'image/jpeg')],
    resolvedSharedPayloads: [resolvedMedia({
      uri: 'content://shares/photo', type: 'image', mimeType: 'image/jpeg', name: 'photo.jpg', size: 12,
    })],
  });
  expect(external).toMatchObject({ kind: 'media', items: [{ sourceOwnership: 'external' }] });
});

test('marks native queue file payloads as native-owned and never exposes them as SDK staging cleanup', () => {
  const uri = 'file:///cache/imediasave-shares/batch/photo.jpg';
  const result = normalizeIncomingShare({
    ...idle,
    sourceOwnership: 'native-share-queue',
    sharedPayloads: [raw(uri, 'image', 'image/jpeg')],
    resolvedSharedPayloads: [resolvedMedia({
      uri, type: 'image', mimeType: 'image/jpeg', name: 'photo.jpg', size: 128,
    })],
  });

  expect(result).toMatchObject({
    kind: 'media', items: [{ sourceOwnership: 'native-share-queue' }],
  });
});

test('does not offer native queue files to rejection staging cleanup', () => {
  const uri = 'file:///cache/imediasave-shares/batch/unsafe.svg';
  expect(normalizeIncomingShare({
    ...idle,
    sourceOwnership: 'native-share-queue',
    sharedPayloads: [raw(uri, 'image', 'image/svg+xml')],
    resolvedSharedPayloads: [resolvedMedia({
      uri, type: 'image', mimeType: 'image/svg+xml', name: 'unsafe.svg', size: 128,
    })],
  })).toMatchObject({ kind: 'rejected', stagingUris: [] });
});

test('scopes identical native rejection keys to their durable batch identity', () => {
  const rejection = (sourceKey: string) => normalizeIncomingShare({
    ...idle,
    sourceOwnership: 'native-share-queue' as const,
    sourceKey,
    error: new Error('rejected'),
    sharedPayloads: [],
    resolvedSharedPayloads: [],
  });

  expect(rejection('batch-1')).not.toMatchObject({ key: (rejection('batch-2') as { key: string }).key });
});

test('replaces a misleading filename extension with the validated MIME extension', () => {
  const result = normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw('content://shares/movie', 'video', 'video/quicktime')],
    resolvedSharedPayloads: [resolvedMedia({
      uri: 'content://shares/movie', type: 'video', mimeType: 'video/quicktime', name: 'movie.mp4', size: 12,
    })],
  });
  expect(result).toMatchObject({ kind: 'media', items: [{ filename: 'movie.mov' }] });
});

test.each([
  ['image/svg+xml', 'image', 'unsafe image subtype'],
  ['audio/mpeg', 'audio', 'audio is outside the receive contract'],
  ['application/octet-stream', 'file', 'generic files are outside the receive contract'],
] as const)('rejects unsupported MIME %s (%s)', (mimeType, shareType, _reason) => {
  const uri = 'content://shares/item';
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(uri, shareType as SharePayload['shareType'], mimeType)],
    resolvedSharedPayloads: [resolvedMedia({
      uri,
      type: shareType === 'image' ? 'image' : 'file',
      mimeType,
      name: 'item.bin',
      size: 10,
    })],
  })).toMatchObject({ kind: 'rejected', code: 'unsupported_mime' });
});

test.each([
  [{ uri: null, size: 100 }, 'missing URI'],
  [{ uri: 'content://shares/missing', size: null }, 'missing size'],
  [{ uri: 'content://shares/empty', size: 0 }, 'empty file'],
] as const)('rejects inaccessible media with %s', (input, _reason) => {
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw('content://shares/item', 'image', 'image/jpeg')],
    resolvedSharedPayloads: [resolvedMedia({
      uri: input.uri,
      type: 'image',
      mimeType: 'image/jpeg',
      name: 'item.jpg',
      size: input.size,
    })],
  })).toMatchObject({ kind: 'rejected', code: 'inaccessible_file' });
});

test('keeps a bounded media set selection-required', () => {
  const payloads = [
    resolvedMedia({ uri: 'content://shares/one', type: 'image', mimeType: 'image/png', name: 'one.png', size: 12 }),
    resolvedMedia({ uri: 'content://shares/two', type: 'video', mimeType: 'video/mp4', name: 'two.mp4', size: 34 }),
  ];
  const result = normalizeIncomingShare({
    ...idle,
    sharedPayloads: payloads.map((payload) => raw(payload.value, payload.shareType, payload.mimeType)),
    resolvedSharedPayloads: payloads,
  });

  expect(result).toMatchObject({ kind: 'media', requiresSelection: true });
  expect(result.kind === 'media' ? result.items : []).toHaveLength(2);
});

test('rejects media sets beyond the bounded receive limit', () => {
  const payloads = Array.from({ length: MAX_INCOMING_MEDIA_ITEMS + 1 }, (_, index) => (
    resolvedMedia({
      uri: `content://shares/${index}`,
      type: 'image',
      mimeType: 'image/jpeg',
      name: `${index}.jpg`,
      size: 100,
    })
  ));

  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: payloads.map((payload) => raw(payload.value, payload.shareType, payload.mimeType)),
    resolvedSharedPayloads: payloads,
  })).toMatchObject({ kind: 'rejected', code: 'too_many_items' });
});

test('rejects mixed text and media instead of partially consuming an unsafe payload', () => {
  const media = resolvedMedia({
    uri: 'content://shares/photo', type: 'image', mimeType: 'image/jpeg', name: 'photo.jpg', size: 100,
  });
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw('https://example.com/one', 'text', 'text/plain'), raw(media.value, 'image', 'image/jpeg')],
    resolvedSharedPayloads: [media],
  })).toMatchObject({ kind: 'rejected', code: 'mixed_payload' });
});

test('rejects a raw generic file even if resolution claims it is an image', () => {
  const media = resolvedMedia({
    uri: 'content://shares/disguised', type: 'image', mimeType: 'image/jpeg', name: 'photo.jpg', size: 100,
  });
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(media.value, 'file', 'application/octet-stream')],
    resolvedSharedPayloads: [media],
  })).toMatchObject({ kind: 'rejected', code: 'unsupported_mime' });
});

test('rejects remote media URLs from the direct local-file path', () => {
  const media = resolvedMedia({
    uri: 'https://cdn.example.com/photo.jpg', type: 'image', mimeType: 'image/jpeg', name: 'photo.jpg', size: 100,
  });
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(media.value, 'image', 'image/jpeg')],
    resolvedSharedPayloads: [media],
  })).toMatchObject({ kind: 'rejected', code: 'inaccessible_file' });
});

test('rejects duplicate media identities within one incoming set', () => {
  const media = resolvedMedia({
    uri: 'content://shares/photo', type: 'image', mimeType: 'image/jpeg', name: 'photo.jpg', size: 100,
  });
  expect(normalizeIncomingShare({
    ...idle,
    sharedPayloads: [raw(media.value, 'image', 'image/jpeg'), raw(media.value, 'image', 'image/jpeg')],
    resolvedSharedPayloads: [media, { ...media }],
  })).toMatchObject({ kind: 'rejected', code: 'duplicate_item' });
});

test('waits for SDK resolution and surfaces resolution errors without consuming raw files', () => {
  const payload = raw('content://shares/photo', 'image', 'image/jpeg');
  expect(normalizeIncomingShare({
    sharedPayloads: [payload], resolvedSharedPayloads: [], isResolving: true, error: null,
  })).toEqual({ kind: 'pending' });
  expect(normalizeIncomingShare({
    sharedPayloads: [payload], resolvedSharedPayloads: [], isResolving: false, error: new Error('permission denied'),
  })).toMatchObject({ kind: 'rejected', code: 'resolution_failed' });
});
