import { describe, expect, test } from 'bun:test'

import { isRasterImage, isSafeThumbnailUrl, proxiedThumbnailUrl, readBoundedStream, verifyThumbnailToken } from './thumbnail'

describe('thumbnail proxy URL policy', () => {
  test('allows known media thumbnail hosts', () => {
    expect(isSafeThumbnailUrl('https://i.ytimg.com/vi/one/hqdefault.jpg')).toBe(true)
    expect(isSafeThumbnailUrl('https://scontent.cdninstagram.com/image.jpg')).toBe(true)
    expect(isSafeThumbnailUrl('https://p16-sign.tiktokcdn-us.com/poster.jpeg')).toBe(true)
  })

  test('rejects credentials, local networks, and unrelated hosts', () => {
    expect(isSafeThumbnailUrl('http://127.0.0.1/admin')).toBe(false)
    expect(isSafeThumbnailUrl('http://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isSafeThumbnailUrl('https://user:pass@i.ytimg.com/image.jpg')).toBe(false)
    expect(isSafeThumbnailUrl('https://evil.example/image.jpg')).toBe(false)
  })

  test('accepts raster signatures and rejects active SVG content', () => {
    expect(isRasterImage('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(isRasterImage('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
    expect(isRasterImage('image/svg+xml', new TextEncoder().encode('<svg><script /></svg>'))).toBe(false)
  })

  test('issues URL-specific expiring proxy tokens', async () => {
    const secret = 'test-thumbnail-secret'
    const remote = 'https://i.ytimg.com/vi/one/hqdefault.jpg'
    const issued = await proxiedThumbnailUrl(remote, 'https://app.example/api/preview', secret, 1_000)
    expect(issued).not.toBeNull()
    const proxy = new URL(issued!)
    const expires = Number(proxy.searchParams.get('expires'))
    const token = proxy.searchParams.get('token')!
    expect(await verifyThumbnailToken(remote, expires, token, secret, 1_000)).toBe(true)
    expect(await verifyThumbnailToken('https://i.ytimg.com/vi/two/hqdefault.jpg', expires, token, secret, 1_000)).toBe(false)
    expect(await verifyThumbnailToken(remote, expires, token, secret, expires + 1)).toBe(false)
  })

  test('stops reading chunked images at the byte limit', async () => {
    const small = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3])); controller.close() } })
    const large = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.enqueue(new Uint8Array([4, 5])); controller.close() } })
    expect(await readBoundedStream(small, 4)).toEqual(new Uint8Array([1, 2, 3]))
    expect(await readBoundedStream(large, 4)).toBeNull()
  })
})
