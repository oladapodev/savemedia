export type KnownPlatform =
  | 'bilibili'
  | 'bsky'
  | 'dailymotion'
  | 'facebook'
  | 'instagram'
  | 'loom'
  | 'newgrounds'
  | 'ok'
  | 'pinterest'
  | 'reddit'
  | 'rutube'
  | 'snapchat'
  | 'soundcloud'
  | 'streamable'
  | 'tiktok'
  | 'tumblr'
  | 'twitch'
  | 'twitter'
  | 'vimeo'
  | 'vk'
  | 'xiaohongshu'
  | 'youtube';

export type NormalizedSharedUrl = {
  url: string;
  platform?: KnownPlatform;
};

const platformHosts: ReadonlyArray<readonly [KnownPlatform, string[]]> = [
  ['bilibili', ['bilibili.com', 'bilibili.tv', 'b23.tv']],
  ['bsky', ['bsky.app']],
  ['dailymotion', ['dailymotion.com', 'dai.ly']],
  ['facebook', ['facebook.com', 'fb.watch']],
  ['instagram', ['instagram.com', 'instagr.am', 'ddinstagram.com']],
  ['loom', ['loom.com']],
  ['newgrounds', ['newgrounds.com']],
  ['ok', ['ok.ru']],
  ['pinterest', ['pinterest.com', 'pin.it']],
  ['reddit', ['reddit.com', 'v.redd.it']],
  ['rutube', ['rutube.ru']],
  ['snapchat', ['snapchat.com', 'snap.com']],
  ['soundcloud', ['soundcloud.com']],
  ['streamable', ['streamable.com']],
  ['tiktok', ['tiktok.com']],
  ['tumblr', ['tumblr.com']],
  ['twitch', ['twitch.tv']],
  ['twitter', ['twitter.com', 'x.com', 'vxtwitter.com', 'fixvx.com']],
  ['vimeo', ['vimeo.com']],
  ['vk', ['vk.com', 'vkvideo.ru', 'vk.ru']],
  ['xiaohongshu', ['xiaohongshu.com', 'xhslink.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
];

function trimSharePunctuation(value: string): string {
  let candidate = value.replace(/[.,;:!?]+$/u, '');
  while (
    (candidate.endsWith(')') &&
      (candidate.match(/\(/gu)?.length ?? 0) < (candidate.match(/\)/gu)?.length ?? 0)) ||
    (candidate.endsWith(']') &&
      (candidate.match(/\[/gu)?.length ?? 0) < (candidate.match(/\]/gu)?.length ?? 0)) ||
    (candidate.endsWith('}') &&
      (candidate.match(/\{/gu)?.length ?? 0) < (candidate.match(/\}/gu)?.length ?? 0))
  ) {
    candidate = candidate.slice(0, -1);
  }
  return candidate;
}

export function detectKnownPlatform(url: string): KnownPlatform | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [platform, hosts] of platformHosts) {
      if (hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        return platform;
      }
    }
  } catch {
    // Normalization is responsible for rejecting invalid URLs.
  }
  return undefined;
}

export function normalizeSharedUrl(value: string): NormalizedSharedUrl | null {
  const candidate = trimSharePunctuation(value.trim());
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    parsed.hash = '';
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    const url = parsed.toString();
    const platform = detectKnownPlatform(url);
    return platform ? { url, platform } : { url };
  } catch {
    return null;
  }
}

/** Extracts only an explicit HTTP(S) URL; it never treats arbitrary text as a URL. */
export function extractSharedUrl(text: string): NormalizedSharedUrl | null {
  const match = text.match(/https?:\/\/[^\s<>"'`]+/iu);
  return match ? normalizeSharedUrl(match[0]) : null;
}
