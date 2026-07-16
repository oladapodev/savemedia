import {
  detectKnownPlatform,
  extractSharedUrl,
  normalizeSharedUrl,
} from './url';

describe('shared URL normalization', () => {
  test('extracts and normalizes the first HTTP(S) URL from shared text', () => {
    expect(
      extractSharedUrl(
        'Watch this: HTTPS://WWW.YouTube.COM:443/watch?v=abc#comments and https://example.com/next',
      ),
    ).toEqual({ url: 'https://www.youtube.com/watch?v=abc', platform: 'youtube' });
  });

  test('rejects non-http schemes and URLs with credentials', () => {
    expect(normalizeSharedUrl('file:///private/item')).toBeNull();
    expect(normalizeSharedUrl('https://name:secret@example.com/post')).toBeNull();
    expect(extractSharedUrl('Try javascript:alert(1)')).toBeNull();
  });

  test('removes fragments, default ports, and trailing share punctuation', () => {
    expect(extractSharedUrl('http://Example.COM:80/video#section).')).toEqual({
      url: 'http://example.com/video',
    });
  });

  test('detects known wrapper platforms without rejecting compatible public URLs', () => {
    expect(detectKnownPlatform('https://www.instagram.com/reel/abc')).toBe('instagram');
    expect(detectKnownPlatform('https://media.example.com/video.mp4')).toBeUndefined();
  });
});
