const THUMBNAIL_HOST_SUFFIXES = [
  'cdninstagram.com',
  'dmcdn.net',
  'fbcdn.net',
  'googleusercontent.com',
  'hdslb.com',
  'instagram.com',
  'loom.com',
  'ngfiles.com',
  'pinimg.com',
  'redditmedia.com',
  'redd.it',
  'rutube.ru',
  'sc-cdn.net',
  'sndcdn.com',
  'streamable.com',
  'tiktokcdn.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-us.com',
  'ttvnw.net',
  'tumblr.com',
  'twimg.com',
  'vimeocdn.com',
  'vkuser.net',
  'vkuserphoto.ru',
  'xhscdn.com',
  'ytimg.com',
] as const

function hasAllowedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/u, '')
  return THUMBNAIL_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

export function isSafeThumbnailUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && hasAllowedHost(url.hostname)
  } catch {
    return false
  }
}

const encoder = new TextEncoder()

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

export function isRasterImage(contentType: string, bytes: Uint8Array) {
  const mime = contentType.split(';')[0].trim().toLowerCase()
  if (mime === 'image/jpeg' || mime === 'image/jpg') return bytesStartWith(bytes, [0xff, 0xd8, 0xff])
  if (mime === 'image/png') return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mime === 'image/gif') return bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38])
  if (mime === 'image/webp') return bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  if (mime === 'image/avif') {
    const brand = new TextDecoder().decode(bytes.slice(4, 12))
    return brand.startsWith('ftyp') && (brand.includes('avif') || brand.includes('avis'))
  }
  return false
}

export async function readBoundedStream(body: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return null
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function hmac(remoteUrl: string, expires: number, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${expires}\n${remoteUrl}`)))
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

export async function verifyThumbnailToken(remoteUrl: string, expires: number, token: string, secret: string, now = Date.now()) {
  if (!secret || !Number.isSafeInteger(expires) || expires <= now || expires > now + 10 * 60_000) return false
  return constantTimeEqual(token, await hmac(remoteUrl, expires, secret))
}

export async function proxiedThumbnailUrl(remoteUrl: string, requestUrl: string, secret: string, now = Date.now()) {
  if (!secret || !isSafeThumbnailUrl(remoteUrl)) return null
  const expires = now + 5 * 60_000
  const proxy = new URL('/api/thumbnail', requestUrl)
  proxy.searchParams.set('url', remoteUrl)
  proxy.searchParams.set('expires', String(expires))
  proxy.searchParams.set('token', await hmac(remoteUrl, expires, secret))
  return proxy.toString()
}
