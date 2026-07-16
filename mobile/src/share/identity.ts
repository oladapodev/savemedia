const TRACKING_PARAMETERS = new Set([
  '_ga',
  'dclid',
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'msclkid',
]);

/** Returns a stable media key, preferring provider IDs over URL spellings. */
export function mediaIdentityFromUrl(sourceUrl: string): string {
  let url: URL;
  try {
    url = new URL(sourceUrl.trim());
  } catch {
    return `url:${sourceUrl.trim()}`;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' && segments[0]) return `youtube:${segments[0]}`;
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const id = url.searchParams.get('v')
      ?? (segments[0] === 'shorts' || segments[0] === 'embed' ? segments[1] : null);
    if (id) return `youtube:${id}`;
  }

  if ((host === 'instagram.com' || host.endsWith('.instagram.com')) && segments[1]) {
    if (segments[0] === 'p') return `instagram:post:${segments[1]}`;
    if (segments[0] === 'reel') return `instagram:reel:${segments[1]}`;
  }

  if ((host === 'tiktok.com' || host.endsWith('.tiktok.com'))) {
    const videoIndex = segments.indexOf('video');
    if (videoIndex >= 0 && segments[videoIndex + 1]) return `tiktok:${segments[videoIndex + 1]}`;
  }

  if ((host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com'))) {
    const statusIndex = segments.indexOf('status');
    if (statusIndex >= 0 && segments[statusIndex + 1]) return `twitter:${segments[statusIndex + 1]}`;
  }

  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hostname = host;
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return `url:${url.toString().replace(/\?$/, '')}`;
}
