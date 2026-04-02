import { createFileRoute } from '@tanstack/react-router'

import { detectPlatform, SUPPORTED_PLATFORM_COPY } from '@/lib/platforms'

interface CobaltResponse {
  status?: 'redirect' | 'tunnel' | 'picker' | 'local-processing' | 'error'
  url?: string
  filename?: string
  error?: unknown
  picker?: Array<{ url: string; thumb?: string; type?: string }>
  audio?: string
  audioFilename?: string
  tunnel?: string[]
  output?: {
    filename?: string
  }
  type?: string
}

const COBALT_ERROR_MESSAGES: Record<string, string> = {
  'error.api.link.invalid': 'The link is invalid or not supported.',
  'error.api.link.unsupported': 'This platform or link type is not supported.',
  'error.api.fetch.fail': 'Could not fetch content from this link. It may be private or unavailable.',
  'error.api.fetch.critical': 'A critical error occurred while fetching content.',
  'error.api.fetch.empty': 'No downloadable content was found at this link.',
  'error.api.content.video.unavailable': 'This video is unavailable. It may be private, deleted, or region-locked.',
  'error.api.content.video.live': 'Live videos cannot be downloaded.',
  'error.api.content.video.age': 'This video is age-restricted and cannot be downloaded.',
  'error.api.content.post.unavailable': 'This post is unavailable or has been deleted.',
  'error.api.youtube.login': 'This YouTube video requires login to access.',
  'error.api.youtube.decipher': 'Failed to process this YouTube video.',
  'error.api.youtube.token_expired': 'YouTube session expired. Please try again.',
  'error.api.instagram.private': 'This Instagram content is from a private account.',
  'error.api.twitter.private': 'This tweet is from a private account.',
  'error.api.rate_exceeded': 'Too many requests. Please wait a moment and try again.',
}

function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString)
    return true
  } catch {
    return false
  }
}

function safeErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return COBALT_ERROR_MESSAGES[value] || value
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>

    if (typeof obj.code === 'string') {
      return COBALT_ERROR_MESSAGES[obj.code] || obj.code
    }

    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message
    }
  }

  return fallback
}

function getDownloadHint(message: string): string | undefined {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('private') ||
    normalized.includes('deleted') ||
    normalized.includes('region') ||
    normalized.includes('age-restricted')
  ) {
    return 'Make sure the link points to a specific public post or video and that it is available in your region.'
  }

  if (normalized.includes('login')) {
    return 'This piece of content currently requires account access on the source platform and cannot be downloaded through iMediaSave.'
  }

  if (normalized.includes('rate')) {
    return 'Please wait briefly before trying again. The internal download service is temporarily rate limited.'
  }

  return 'Try the request again in a moment. If the issue continues, confirm the post is public and directly accessible.'
}

function buildCobaltBody(url: string, quality: string | undefined, platform: string) {
  const audioOnly = quality === 'audio'

  return {
    url,
    videoQuality: audioOnly ? '1080' : (quality || '1080'),
    downloadMode: audioOnly ? 'audio' : 'auto',
    audioBitrate: '320',
    audioFormat: 'mp3',
    filenameStyle: 'pretty',
    youtubeVideoCodec: platform === 'youtube' ? 'h264' : undefined,
    tiktokFullAudio: platform === 'tiktok',
  }
}

async function requestCobalt(
  body: Record<string, unknown>,
  apiBaseUrl: string,
  apiKey?: string,
): Promise<{ response: Response; data: CobaltResponse | null }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Api-Key ${apiKey}`
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => null)
  return { response, data }
}

export const Route = createFileRoute('/api/download')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { url, quality } = body as {
            url?: string
            quality?: string
          }

          if (!url) {
            return Response.json({ error: 'URL is required' }, { status: 400 })
          }

          if (!isValidUrl(url)) {
            return Response.json({ error: 'Please provide a valid URL' }, { status: 400 })
          }

          const platform = detectPlatform(url)
          if (!platform) {
            return Response.json(
              { error: `Unsupported platform. Supported: ${SUPPORTED_PLATFORM_COPY}` },
              { status: 400 },
            )
          }

          const cobaltApiUrl = process.env.COBALT_API_URL
          const cobaltApiKey = process.env.COBALT_API_KEY

          if (!cobaltApiUrl) {
            console.error('COBALT_API_URL is not configured')
            return Response.json(
              { error: 'The download service is not configured yet. Please contact support.' },
              { status: 500 },
            )
          }

          const cobaltBody = buildCobaltBody(url, quality, platform)
          const { response, data } = await requestCobalt(cobaltBody, cobaltApiUrl, cobaltApiKey)

          if (!data) {
            return Response.json(
              {
                error: 'The download service returned an invalid response.',
                platform,
                hint: 'Please try again in a moment. If the problem continues, the internal processing service may be restarting.',
              },
              { status: 502 },
            )
          }

          if (response.status === 401 || response.status === 403) {
            return Response.json(
              {
                error: 'The internal download processor is temporarily unavailable.',
                platform,
                hint: 'iMediaSave could not authenticate with the private media service. Please check the server configuration.',
              },
              { status: 502 },
            )
          }

          if (data.status === 'error') {
            const errorMessage = safeErrorMessage(data.error, 'Failed to process this link.')
            return Response.json(
              {
                error: errorMessage,
                platform,
                hint: getDownloadHint(errorMessage),
              },
              { status: response.ok ? 422 : 502 },
            )
          }

          if ((data.status === 'redirect' || data.status === 'tunnel') && data.url) {
            return Response.json({
              success: true,
              platform,
              downloadUrl: data.url,
              filename: data.filename || `${platform}-media`,
              type: quality === 'audio' ? 'audio' : 'video',
            })
          }

          if (data.status === 'picker' && Array.isArray(data.picker)) {
            const items = data.picker.map((item, index) => ({
              url: item.url,
              thumb: item.thumb,
              type: item.type || 'video',
              filename: `${platform}-media-${index + 1}`,
            }))

            return Response.json({
              success: true,
              platform,
              multiple: true,
              items,
              audio: data.audio,
              audioFilename: data.audioFilename,
            })
          }

          if (data.status === 'local-processing') {
            return Response.json(
              {
                error: 'This media requires additional local processing and is not supported by the current iMediaSave flow.',
                platform,
                hint: 'Try a different quality or media type. Support for this processing mode can be added later if needed.',
              },
              { status: 422 },
            )
          }

          if (data.url) {
            return Response.json({
              success: true,
              platform,
              downloadUrl: data.url,
              filename: data.filename || data.output?.filename || `${platform}-media`,
              type: quality === 'audio' ? 'audio' : (data.type || 'video'),
            })
          }

          return Response.json(
            {
              error: 'The download service did not return a usable file.',
              platform,
              hint: 'Try another quality setting or a different public media URL.',
            },
            { status: 502 },
          )
        } catch (err) {
          console.error('Download API error:', err)
          return Response.json(
            { error: 'Failed to process request. Please try again.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
