import { mediaIdentityFromUrl } from './identity';

describe('mediaIdentityFromUrl', () => {
  test.each([
    ['https://www.youtube.com/watch?v=AbC_123&utm_source=share', 'youtube:AbC_123'],
    ['https://youtu.be/AbC_123?si=tracking', 'youtube:AbC_123'],
    ['https://youtube.com/shorts/AbC_123?feature=share', 'youtube:AbC_123'],
    ['https://youtube.com/embed/AbC_123#player', 'youtube:AbC_123'],
    ['https://www.instagram.com/p/PostCode/?utm_medium=copy_link', 'instagram:post:PostCode'],
    ['https://instagram.com/reel/ReelCode/?igshid=tracking', 'instagram:reel:ReelCode'],
    ['https://www.tiktok.com/@creator/video/7400000000000000000?is_from_webapp=1', 'tiktok:7400000000000000000'],
    ['https://x.com/user/status/1900000000000000000?s=20', 'twitter:1900000000000000000'],
    ['https://twitter.com/other/status/1900000000000000000#thread', 'twitter:1900000000000000000'],
  ])('extracts a stable platform identity from %s', (url, expected) => {
    expect(mediaIdentityFromUrl(url)).toBe(expected);
  });

  test('keeps distinct YouTube video IDs distinct', () => {
    expect(mediaIdentityFromUrl('https://youtube.com/watch?v=video-one'))
      .not.toBe(mediaIdentityFromUrl('https://youtube.com/watch?v=video-two'));
  });

  test('canonicalizes fallback URLs without discarding meaningful query parameters', () => {
    expect(mediaIdentityFromUrl(
      'https://EXAMPLE.com:443/media/?b=two&utm_source=share&a=one&fbclid=tracking#fragment',
    )).toBe('url:https://example.com/media?a=one&b=two');
  });

  test('makes fallback tracking variants collide', () => {
    expect(mediaIdentityFromUrl('https://example.com/media?id=42&utm_campaign=launch'))
      .toBe(mediaIdentityFromUrl('https://example.com/media?fbclid=tracking&id=42'));
  });
});
