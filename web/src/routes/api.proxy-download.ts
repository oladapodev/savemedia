import { createFileRoute } from '@tanstack/react-router'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition, Content-Type, Accept-Ranges, Content-Range',
}

function errorHtmlPage(title: string, message: string, hint?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Error - iMediaSave</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e5e5e5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 16px; padding: 2rem; max-width: 440px; text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #f97316; }
    p { font-size: 0.9rem; color: #999; line-height: 1.5; }
    .hint { margin-top: 1rem; padding: 0.75rem 1rem; background: #1f1f1f; border-radius: 8px; font-size: 0.8rem; color: #777; }
    .btn { display: inline-block; margin-top: 1.25rem; padding: 0.6rem 1.5rem; background: #f97316; color: #fff; font-size: 0.85rem; font-weight: 600; border-radius: 8px; text-decoration: none; }
    .btn:hover { background: #ea580c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${hint ? `<div class="hint">${hint}</div>` : ''}
    <a class="btn" href="javascript:window.close();" onclick="window.close(); return false;">Close</a>
  </div>
</body>
</html>`
}

export const Route = createFileRoute('/api/proxy-download')({
  server: {
    handlers: {
      // Handle preflight requests for CORS
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        })
      },

      HEAD: async ({ request }) => {
        try {
          const { searchParams } = new URL(request.url)
          const mediaUrl = searchParams.get('url')

          if (!mediaUrl) {
            return new Response(null, {
              status: 400,
              headers: CORS_HEADERS,
            })
          }

          const parsed = new URL(mediaUrl)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return new Response(null, {
              status: 400,
              headers: CORS_HEADERS,
            })
          }

          const res = await fetch(mediaUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              Referer: mediaUrl,
            },
            redirect: 'follow',
          })

          if (res.status === 405 || res.status === 501) {
            return new Response(null, {
              status: 204,
              headers: CORS_HEADERS,
            })
          }

          const headers: Record<string, string> = {
            ...CORS_HEADERS,
          }

          const contentType = res.headers.get('content-type')
          if (contentType) {
            headers['Content-Type'] = contentType
          }

          const contentLength = res.headers.get('content-length')
          if (contentLength) {
            headers['Content-Length'] = contentLength
          }

          return new Response(null, {
            status: res.status,
            headers,
          })
        } catch {
          return new Response(null, {
            status: 500,
            headers: CORS_HEADERS,
          })
        }
      },

      GET: async ({ request }) => {
        try {
          const { searchParams } = new URL(request.url)
          const mediaUrl = searchParams.get('url')
          const filename = searchParams.get('filename') || 'media'

          if (!mediaUrl) {
            return new Response(
              errorHtmlPage('Missing URL', 'No download URL was provided.'),
              { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } },
            )
          }

          // Validate URL
          try {
            const parsed = new URL(mediaUrl)
            // Only allow http/https protocols
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              return new Response(
                errorHtmlPage('Invalid URL', 'The download URL uses an unsupported protocol.'),
                { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } },
              )
            }
          } catch {
            return new Response(
              errorHtmlPage('Invalid URL', 'The download URL is malformed.'),
              { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } },
            )
          }

          // Fetch the media file with timeout
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 120000) // 2 minute timeout for large files

          // Forward Range header for resume support
          const fetchHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: mediaUrl,
          }

          const rangeHeader = request.headers.get('Range')
          if (rangeHeader) {
            fetchHeaders['Range'] = rangeHeader
          }

          const res = await fetch(mediaUrl, {
            headers: fetchHeaders,
            redirect: 'follow',
            signal: controller.signal,
          })

          clearTimeout(timeout)

          if (!res.ok && res.status !== 206) {
            const statusTitle = res.status === 403
              ? 'Access Denied'
              : res.status === 404
                ? 'Not Found'
                : res.status === 410
                  ? 'Link Expired'
                  : 'Download Failed'

            const statusMsg = res.status === 403
              ? 'The media server denied access. The download link may have expired.'
              : res.status === 404
                ? 'The media file was not found. The download link may have expired.'
                : res.status === 410
                  ? 'This download link has expired.'
                  : `The media server returned an error (HTTP ${res.status}).`

            return new Response(
              errorHtmlPage(statusTitle, statusMsg, 'Go back to iMediaSave and click "Get Download Link" again to get a fresh link.'),
              { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } },
            )
          }

          const contentType = res.headers.get('content-type') || 'application/octet-stream'

          // Detect if the response is an error page instead of actual media
          if (contentType.includes('text/html') || contentType.includes('application/json')) {
            return new Response(
              errorHtmlPage(
                'Invalid Download',
                'The download server returned an error page instead of the media file.',
                'Go back to iMediaSave and click "Get Download Link" again to get a fresh link.',
              ),
              { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } },
            )
          }

          const ext = contentType.includes('video/mp4') ? '.mp4'
            : contentType.includes('video/webm') ? '.webm'
            : contentType.includes('video') ? '.mp4'
            : contentType.includes('audio/mpeg') ? '.mp3'
            : contentType.includes('audio/mp4') ? '.m4a'
            : contentType.includes('audio/ogg') ? '.ogg'
            : contentType.includes('audio') ? '.m4a'
            : contentType.includes('image/png') ? '.png'
            : contentType.includes('image/gif') ? '.gif'
            : contentType.includes('image/webp') ? '.webp'
            : contentType.includes('image') ? '.jpg'
            : ''

          const fullFilename = filename.includes('.') ? filename : `${filename}${ext}`
          // Sanitize filename for Content-Disposition header
          const safeFilename = fullFilename.replace(/[^\w.\-_ ]/g, '_')

          const headers: Record<string, string> = {
            ...CORS_HEADERS,
            'Content-Type': contentType,
            // Use both filename and filename* for maximum browser compatibility
            'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(fullFilename)}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
          }

          // Forward content length if available
          const contentLength = res.headers.get('content-length')
          if (contentLength) {
            headers['Content-Length'] = contentLength
          }

          // Forward range-related headers for resume support
          const acceptRanges = res.headers.get('accept-ranges')
          if (acceptRanges) {
            headers['Accept-Ranges'] = acceptRanges
          }
          const contentRange = res.headers.get('content-range')
          if (contentRange) {
            headers['Content-Range'] = contentRange
          }

          return new Response(res.body, {
            status: res.status, // Preserve 206 for partial content
            headers,
          })
        } catch (err) {
          console.error('Proxy download error:', err)
          const isTimeout = err instanceof DOMException && err.name === 'AbortError'
          return new Response(
            errorHtmlPage(
              isTimeout ? 'Download Timed Out' : 'Download Failed',
              isTimeout
                ? 'The file took too long to download. It may be too large or the server is slow.'
                : 'An unexpected error occurred while downloading the file.',
              'Go back to iMediaSave and try again. You can also try a lower quality setting.',
            ),
            {
              status: isTimeout ? 504 : 500,
              headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
            },
          )
        }
      },
    },
  },
})
