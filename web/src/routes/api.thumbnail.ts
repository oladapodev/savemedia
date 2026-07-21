import { createFileRoute } from '@tanstack/react-router'
import { isRasterImage, isSafeThumbnailUrl, readBoundedStream, verifyThumbnailToken } from '@/lib/thumbnail'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_CONCURRENT_FETCHES = 12
const MAX_REDIRECTS = 3
let activeFetches = 0

async function discard(response: Response) {
  try { await response.body?.cancel() } catch { /* Upstream rejection is already authoritative. */ }
}

async function fetchImage(remoteUrl: string) {
  let current = remoteUrl
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (!isSafeThumbnailUrl(current)) return null
    const response = await fetch(current, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; iMediaSave/1.0)',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await discard(response)
      if (!location || redirect === MAX_REDIRECTS) return null
      current = new URL(location, current).toString()
      continue
    }
    if (!response.ok) {
      await discard(response)
      return null
    }
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (!contentType || !['image/avif', 'image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(contentType)) {
      await discard(response)
      return null
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_BYTES) {
      await discard(response)
      return null
    }
    const bytes = await readBoundedStream(response.body, MAX_BYTES)
    if (!bytes || !isRasterImage(contentType, bytes)) return null
    return { bytes, contentType }
  }
  return null
}

export const Route = createFileRoute('/api/thumbnail')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const remoteUrl = params.get('url')
        const expires = Number(params.get('expires'))
        const token = params.get('token') || ''
        const secret = process.env.THUMBNAIL_PROXY_SECRET || process.env.COBALT_API_KEY || ''
        if (!remoteUrl || !isSafeThumbnailUrl(remoteUrl) || !(await verifyThumbnailToken(remoteUrl, expires, token, secret))) {
          return Response.json({ error: 'Invalid thumbnail URL' }, { status: 400 })
        }
        if (activeFetches >= MAX_CONCURRENT_FETCHES) {
          return Response.json({ error: 'Thumbnail service busy' }, { headers: { 'Retry-After': '2' }, status: 429 })
        }
        activeFetches += 1
        try {
          const image = await fetchImage(remoteUrl)
          if (!image) return Response.json({ error: 'Thumbnail unavailable' }, { status: 502 })
          const remainingSeconds = Math.max(0, Math.floor((expires - Date.now()) / 1000))
          return new Response(image.bytes, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': `public, max-age=${remainingSeconds}, immutable`,
              'Content-Length': String(image.bytes.byteLength),
              'Content-Type': image.contentType,
              'X-Content-Type-Options': 'nosniff',
            },
          })
        } catch {
          return Response.json({ error: 'Thumbnail unavailable' }, { status: 502 })
        } finally {
          activeFetches -= 1
        }
      },
    },
  },
})
