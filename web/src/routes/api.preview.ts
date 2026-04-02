import { createFileRoute } from '@tanstack/react-router'
import { detectPlatform, SUPPORTED_PLATFORM_COPY } from '@/lib/platforms'

// Platform-specific oEmbed endpoints
const OEMBED_ENDPOINTS: Record<string, string> = {
  youtube: 'https://www.youtube.com/oembed',
  tiktok: 'https://www.tiktok.com/oembed',
  twitter: 'https://publish.twitter.com/oembed',
}

// Multiple fallback oEmbed proxy services
const OEMBED_PROXIES = [
  'https://noembed.com/embed',
  'https://iframe.ly/api/oembed',
]

async function fetchOEmbed(url: string, platform: string) {
  const endpoint = OEMBED_ENDPOINTS[platform]
  if (!endpoint) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const oembedUrl = `${endpoint}?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iMediaSave/1.0)' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    if (data.error) return null
    return data
  } catch {
    return null
  }
}

// Try multiple oEmbed proxy services as fallback
async function fetchOEmbedProxy(url: string) {
  for (const proxy of OEMBED_PROXIES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(`${proxy}?url=${encodeURIComponent(url)}&format=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iMediaSave/1.0)' },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) continue
      const data = await res.json()
      if (data.error) continue
      return data
    } catch {
      continue
    }
  }
  return null
}

// Extract Open Graph / meta tags from page HTML as a fallback
async function fetchOpenGraph(url: string): Promise<Record<string, string> | null> {
  // Try with different user agents — some platforms block bot UAs but allow browser-like ones
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  ]

  for (const ua of userAgents) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) continue

      const html = await res.text()
      const meta: Record<string, string> = {}

      // Extract og: and twitter: meta tags — handle both property-first and content-first orderings
      const metaRegex = /<meta\s+[^>]*?(?:(?:property|name)\s*=\s*["'](og:|twitter:)([^"']+)["'][^>]*?content\s*=\s*["']([^"']*?)["']|content\s*=\s*["']([^"']*?)["'][^>]*?(?:property|name)\s*=\s*["'](og:|twitter:)([^"']+)["'])[^>]*\/?>/gi
      let match
      while ((match = metaRegex.exec(html)) !== null) {
        if (match[1] && match[2] && match[3]) {
          meta[`${match[1]}${match[2]}`] = match[3]
        } else if (match[4] && match[5] && match[6]) {
          meta[`${match[5]}${match[6]}`] = match[4]
        }
      }

      // Also extract standard meta description
      const descMatch = html.match(/<meta\s+[^>]*?name\s*=\s*["']description["'][^>]*?content\s*=\s*["']([^"']*?)["'][^>]*\/?>/i)
      if (descMatch) {
        meta['description'] = descMatch[1].trim()
      }

      // Also try to get <title>
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        meta['title'] = titleMatch[1].trim()
      }

      if (Object.keys(meta).length > 0) return meta
    } catch {
      continue
    }
  }

  return null
}

// Generate YouTube thumbnail from video ID
function getYouTubeThumbnail(url: string): string | null {
  try {
    const parsed = new URL(url)
    let videoId: string | null = null
    if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1).split('/')[0].split('?')[0]
    } else if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v')
      if (!videoId) {
        const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/)
        if (shortsMatch) videoId = shortsMatch[1]
        const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/)
        if (embedMatch) videoId = embedMatch[1]
      }
    }
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    }
    return null
  } catch {
    return null
  }
}

// Platform-specific thumbnail extraction from URL patterns
function getPlatformThumbnailFromUrl(url: string, platform: string): string | null {
  try {
    const parsed = new URL(url)
    switch (platform) {
      case 'youtube':
        return getYouTubeThumbnail(url)
      case 'tiktok': {
        // TikTok video IDs can be extracted from URLs but thumbnails require API
        return null
      }
      case 'instagram': {
        // Instagram shortcode-based thumbnail
        const instaMatch = parsed.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)
        if (instaMatch) {
          // Instagram CDN thumbnail via embed page
          return `https://www.instagram.com/${instaMatch[1]}/${instaMatch[2]}/media/?size=l`
        }
        return null
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

// Extract meaningful title from URL path
function getTitleFromUrl(url: string, platform: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname

    switch (platform) {
      case 'youtube': {
        if (path.includes('/shorts/')) return 'YouTube Short'
        return 'YouTube Video'
      }
      case 'tiktok': {
        const userMatch = path.match(/@([^/]+)/)
        if (userMatch) return `TikTok by @${userMatch[1]}`
        return 'TikTok Video'
      }
      case 'instagram': {
        if (path.includes('/reel')) return 'Instagram Reel'
        if (path.includes('/stories/')) return 'Instagram Story'
        if (path.includes('/p/')) return 'Instagram Post'
        return 'Instagram Content'
      }
      case 'twitter': {
        const tweetUserMatch = path.match(/^\/([^/]+)\/status/)
        if (tweetUserMatch) return `Post by @${tweetUserMatch[1]}`
        return 'X / Twitter Post'
      }
      case 'facebook': {
        if (path.includes('/videos/') || path.includes('/watch/')) return 'Facebook Video'
        if (path.includes('/reel/')) return 'Facebook Reel'
        return 'Facebook Content'
      }
      case 'snapchat': {
        if (path.includes('/spotlight/')) return 'Snapchat Spotlight'
        return 'Snapchat Content'
      }
      case 'pinterest': {
        if (path.includes('/pin/')) return 'Pinterest Pin'
        return 'Pinterest Content'
      }
      default:
        return `${platform.charAt(0).toUpperCase() + platform.slice(1)} content`
    }
  } catch {
    return `${platform.charAt(0).toUpperCase() + platform.slice(1)} content`
  }
}

export const Route = createFileRoute('/api/preview')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { url } = body as { url?: string }

          if (!url) {
            return Response.json({ error: 'URL is required' }, { status: 400 })
          }

          try {
            new URL(url)
          } catch {
            return Response.json({ error: 'Invalid URL' }, { status: 400 })
          }

          const platform = detectPlatform(url)
          if (!platform) {
            return Response.json(
              { error: `Unsupported platform. Supported: ${SUPPORTED_PLATFORM_COPY}` },
              { status: 400 },
            )
          }

          const preview: Record<string, unknown> = {
            platform,
            url,
          }

          // Run all preview strategies in parallel for speed
          const [oembed, oembedProxy, ogData, platformThumb] = await Promise.all([
            fetchOEmbed(url, platform),
            fetchOEmbedProxy(url),
            fetchOpenGraph(url),
            Promise.resolve(getPlatformThumbnailFromUrl(url, platform)),
          ])

          // Merge data from best available source
          // Priority: platform oEmbed > proxy oEmbed > OG tags > URL-derived

          const bestOembed = (oembed && !oembed.error) ? oembed : (oembedProxy && !oembedProxy.error) ? oembedProxy : null

          if (bestOembed) {
            preview.title = bestOembed.title || bestOembed.author_name || null
            preview.author = bestOembed.author_name || null
            preview.authorUrl = bestOembed.author_url || null
            preview.thumbnail = bestOembed.thumbnail_url || null
            preview.thumbnailWidth = bestOembed.thumbnail_width || null
            preview.thumbnailHeight = bestOembed.thumbnail_height || null
            preview.html = bestOembed.html || null
            preview.type = bestOembed.type || null
            preview.providerName = bestOembed.provider_name || platform
          }

          // Fill in missing data from OG tags
          if (ogData) {
            if (!preview.title) {
              preview.title = ogData['og:title'] || ogData['twitter:title'] || ogData['title'] || null
            }
            if (!preview.thumbnail) {
              preview.thumbnail = ogData['og:image'] || ogData['twitter:image'] || null
            }
            if (!preview.author) {
              preview.author = ogData['og:site_name'] || null
            }
            if (!preview.description) {
              preview.description = ogData['og:description'] || ogData['twitter:description'] || ogData['description'] || null
            }
            if (!preview.type) {
              preview.type = ogData['og:type'] || null
            }
          }

          // Fill in missing thumbnail from platform-specific URL parsing
          if (!preview.thumbnail && platformThumb) {
            preview.thumbnail = platformThumb
          }

          // Generate a meaningful title from URL if nothing else worked
          if (!preview.title) {
            preview.title = getTitleFromUrl(url, platform)
          }

          // Ensure defaults
          if (!preview.type) {
            preview.type = 'video'
          }
          if (!preview.providerName) {
            preview.providerName = platform
          }

          // Always return success — even with minimal data the UI can show a usable preview
          return Response.json({ success: true, ...preview })
        } catch (err) {
          console.error('Preview API error:', err)
          return Response.json({ error: 'Failed to fetch preview' }, { status: 500 })
        }
      },
    },
  },
})
