export interface SupportedPlatform {
  id: string
  name: string
  hosts: string[]
  color: string
  iconPath: string
}

export const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  { id: 'bilibili', name: 'Bilibili', hosts: ['bilibili.com', 'bilibili.tv', 'b23.tv'], color: 'from-sky-400 to-cyan-500', iconPath: '/platform-logos/simple-bilibili.svg' },
  { id: 'bsky', name: 'Bluesky', hosts: ['bsky.app'], color: 'from-sky-500 to-blue-600', iconPath: '/platform-logos/simple-bsky.svg' },
  { id: 'dailymotion', name: 'Dailymotion', hosts: ['dailymotion.com', 'dai.ly'], color: 'from-indigo-500 to-blue-600', iconPath: '/platform-logos/simple-dailymotion.svg' },
  { id: 'facebook', name: 'Facebook', hosts: ['facebook.com', 'fb.watch'], color: 'from-blue-600 to-blue-700', iconPath: '/platform-logos/simple-facebook.svg' },
  { id: 'instagram', name: 'Instagram', hosts: ['instagram.com', 'instagr.am', 'ddinstagram.com'], color: 'from-purple-600 via-pink-500 to-orange-400', iconPath: '/platform-logos/simple-instagram.svg' },
  { id: 'loom', name: 'Loom', hosts: ['loom.com'], color: 'from-violet-500 to-fuchsia-600', iconPath: '/platform-logos/simple-loom.svg' },
  { id: 'newgrounds', name: 'Newgrounds', hosts: ['newgrounds.com'], color: 'from-amber-500 to-orange-600', iconPath: '/platform-logos/simple-newgrounds.svg' },
  { id: 'ok', name: 'OK.ru', hosts: ['ok.ru'], color: 'from-orange-500 to-amber-500', iconPath: '/platform-logos/simple-ok.svg' },
  { id: 'pinterest', name: 'Pinterest', hosts: ['pinterest.com', 'pin.it'], color: 'from-red-500 to-rose-600', iconPath: '/platform-logos/simple-pinterest.svg' },
  { id: 'reddit', name: 'Reddit', hosts: ['reddit.com', 'v.redd.it'], color: 'from-orange-500 to-red-500', iconPath: '/platform-logos/simple-reddit.svg' },
  { id: 'rutube', name: 'RUTUBE', hosts: ['rutube.ru'], color: 'from-emerald-500 to-green-600', iconPath: '/platform-logos/simple-rutube.svg' },
  { id: 'snapchat', name: 'Snapchat', hosts: ['snapchat.com', 'snap.com'], color: 'from-yellow-400 to-yellow-500', iconPath: '/platform-logos/simple-snapchat.svg' },
  { id: 'soundcloud', name: 'SoundCloud', hosts: ['soundcloud.com'], color: 'from-orange-500 to-orange-600', iconPath: '/platform-logos/simple-soundcloud.svg' },
  { id: 'streamable', name: 'Streamable', hosts: ['streamable.com'], color: 'from-sky-500 to-blue-600', iconPath: '/platform-logos/simple-streamable.svg' },
  { id: 'tiktok', name: 'TikTok', hosts: ['tiktok.com'], color: 'from-[#ff0050] to-[#00f2ea]', iconPath: '/platform-logos/simple-tiktok.svg' },
  { id: 'tumblr', name: 'Tumblr', hosts: ['tumblr.com'], color: 'from-slate-700 to-slate-900', iconPath: '/platform-logos/simple-tumblr.svg' },
  { id: 'twitch', name: 'Twitch', hosts: ['twitch.tv'], color: 'from-violet-600 to-purple-700', iconPath: '/platform-logos/simple-twitch.svg' },
  { id: 'twitter', name: 'X / Twitter', hosts: ['twitter.com', 'x.com', 'vxtwitter.com', 'fixvx.com'], color: 'from-gray-800 to-black', iconPath: '/platform-logos/simple-twitter.svg' },
  { id: 'vimeo', name: 'Vimeo', hosts: ['vimeo.com'], color: 'from-cyan-500 to-sky-600', iconPath: '/platform-logos/simple-vimeo.svg' },
  { id: 'vk', name: 'VK', hosts: ['vk.com', 'vkvideo.ru', 'vk.ru'], color: 'from-blue-500 to-indigo-600', iconPath: '/platform-logos/simple-vk.svg' },
  { id: 'xiaohongshu', name: 'Xiaohongshu', hosts: ['xiaohongshu.com', 'xhslink.com'], color: 'from-rose-500 to-pink-600', iconPath: '/platform-logos/simple-xiaohongshu.svg' },
  { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'youtu.be'], color: 'from-red-600 to-red-500', iconPath: '/platform-logos/simple-youtube.svg' },
]

export const PLATFORM_NAMES = Object.fromEntries(SUPPORTED_PLATFORMS.map((platform) => [platform.id, platform.name])) as Record<string, string>
export const PLATFORM_COLORS = Object.fromEntries(SUPPORTED_PLATFORMS.map((platform) => [platform.id, platform.color])) as Record<string, string>
export const PLATFORM_ICON_PATHS = Object.fromEntries(SUPPORTED_PLATFORMS.map((platform) => [platform.id, platform.iconPath])) as Record<string, string>
export const SUPPORTED_PLATFORM_NAMES = SUPPORTED_PLATFORMS.map((platform) => platform.name)
export const SUPPORTED_PLATFORM_COPY = SUPPORTED_PLATFORM_NAMES.join(', ')

export function getPlatform(platformId: string) {
  return SUPPORTED_PLATFORMS.find((platform) => platform.id === platformId)
}

export function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    for (const platform of SUPPORTED_PLATFORMS) {
      if (platform.hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) return platform.id
    }
    return null
  } catch {
    return null
  }
}
