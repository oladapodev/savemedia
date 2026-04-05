export interface SupportedPlatform {
  id: string
  name: string
  hosts: string[]
  color: string
}

export const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  { id: 'bilibili', name: 'Bilibili', hosts: ['bilibili.com', 'bilibili.tv', 'b23.tv'], color: 'from-sky-400 to-cyan-500' },
  { id: 'bsky', name: 'Bluesky', hosts: ['bsky.app'], color: 'from-sky-500 to-blue-600' },
  { id: 'dailymotion', name: 'Dailymotion', hosts: ['dailymotion.com', 'dai.ly'], color: 'from-indigo-500 to-blue-600' },
  { id: 'facebook', name: 'Facebook', hosts: ['facebook.com', 'fb.watch'], color: 'from-blue-600 to-blue-700' },
  { id: 'instagram', name: 'Instagram', hosts: ['instagram.com', 'instagr.am', 'ddinstagram.com'], color: 'from-purple-600 via-pink-500 to-orange-400' },
  { id: 'loom', name: 'Loom', hosts: ['loom.com'], color: 'from-violet-500 to-fuchsia-600' },
  { id: 'newgrounds', name: 'Newgrounds', hosts: ['newgrounds.com'], color: 'from-amber-500 to-orange-600' },
  { id: 'ok', name: 'OK.ru', hosts: ['ok.ru'], color: 'from-orange-500 to-amber-500' },
  { id: 'pinterest', name: 'Pinterest', hosts: ['pinterest.com', 'pin.it'], color: 'from-red-500 to-rose-600' },
  { id: 'reddit', name: 'Reddit', hosts: ['reddit.com', 'v.redd.it'], color: 'from-orange-500 to-red-500' },
  { id: 'rutube', name: 'Rutube', hosts: ['rutube.ru'], color: 'from-emerald-500 to-green-600' },
  { id: 'snapchat', name: 'Snapchat', hosts: ['snapchat.com', 'snap.com'], color: 'from-yellow-400 to-yellow-500' },
  { id: 'soundcloud', name: 'SoundCloud', hosts: ['soundcloud.com'], color: 'from-orange-500 to-orange-600' },
  { id: 'streamable', name: 'Streamable', hosts: ['streamable.com'], color: 'from-slate-500 to-slate-700' },
  { id: 'tiktok', name: 'TikTok', hosts: ['tiktok.com'], color: 'from-[#ff0050] to-[#00f2ea]' },
  { id: 'tumblr', name: 'Tumblr', hosts: ['tumblr.com'], color: 'from-slate-700 to-slate-900' },
  { id: 'twitch', name: 'Twitch', hosts: ['twitch.tv'], color: 'from-violet-600 to-purple-700' },
  { id: 'twitter', name: 'X / Twitter', hosts: ['twitter.com', 'x.com', 'vxtwitter.com', 'fixvx.com'], color: 'from-blue-400 to-blue-600' },
  { id: 'vimeo', name: 'Vimeo', hosts: ['vimeo.com'], color: 'from-cyan-500 to-sky-600' },
  { id: 'vk', name: 'VK', hosts: ['vk.com', 'vkvideo.ru', 'vk.ru'], color: 'from-blue-500 to-indigo-600' },
  { id: 'xiaohongshu', name: 'Xiaohongshu', hosts: ['xiaohongshu.com', 'xhslink.com'], color: 'from-rose-500 to-pink-600' },
  { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'youtu.be'], color: 'from-red-600 to-red-500' },
]

export const PLATFORM_NAMES = Object.fromEntries(SUPPORTED_PLATFORMS.map((platform) => [platform.id, platform.name])) as Record<string, string>
export const PLATFORM_COLORS = Object.fromEntries(SUPPORTED_PLATFORMS.map((platform) => [platform.id, platform.color])) as Record<string, string>
export const SUPPORTED_PLATFORM_NAMES = SUPPORTED_PLATFORMS.map((platform) => platform.name)
export const SUPPORTED_PLATFORM_COPY = SUPPORTED_PLATFORM_NAMES.join(', ')

export function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase()

    for (const platform of SUPPORTED_PLATFORMS) {
      if (platform.hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        return platform.id
      }
    }

    return null
  } catch {
    return null
  }
}
