import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { concreteDownloadMime, filenameForConcreteDownloadMime } from './downloadMime'
import { iMediaSaveOpenApiSpec } from './imediasave-openapi'

describe('public wrapper concrete MIME contract', () => {
  test.each([
    ['audio quality', { quality: 'audio', filename: 'song', url: 'https://cdn.test/file' }, 'audio/mpeg'],
    ['JPEG filename', { filename: 'photo.jpeg', url: 'https://cdn.test/file' }, 'image/jpeg'],
    ['WebM URL', { filename: 'clip', url: 'https://cdn.test/clip.webm' }, 'video/webm'],
    ['concrete response type', { filename: 'clip', url: 'https://cdn.test/file', contentType: 'video/mp4; charset=binary' }, 'video/mp4'],
    ['GIF picker type', { filename: 'media', url: 'https://cdn.test/file', pickerType: 'gif' }, 'image/gif'],
  ] as const)('derives %s without returning a wildcard', (_label, input, expected) => {
    expect(concreteDownloadMime(input)).toBe(expected)
  })

  test('refuses unsupported or ambiguous metadata', () => {
    expect(concreteDownloadMime({ filename: 'media', url: 'https://cdn.test/file' })).toBeNull()
    expect(concreteDownloadMime({ filename: 'file.bin', url: 'https://cdn.test/file', contentType: 'application/octet-stream' })).toBeNull()
  })

  test('aligns a misleading filename extension with its concrete MIME', () => {
    expect(filenameForConcreteDownloadMime('clip.webm', 'video/mp4')).toBe('clip.mp4')
    expect(filenameForConcreteDownloadMime('song', 'audio/mpeg')).toBe('song.mp3')
  })

  test('documents concrete mimeType as required for single and picker downloads', () => {
    const schemas = iMediaSaveOpenApiSpec.components.schemas

    expect(schemas.SingleDownloadResponse.required).toContain('mimeType')
    expect(schemas.DownloadItem.required).toContain('mimeType')
    expect(schemas.SingleDownloadResponse.properties.mimeType.enum).toContain('audio/mpeg')
  })

  test('keeps picker audio quality as a concrete MP3 wrapper response', async () => {
    const route = await Bun.file(resolve(import.meta.dir, '../routes/api.download.ts')).text()

    expect(route).toContain("quality === 'audio' && data.audio")
    expect(route).toContain("mimeType: 'audio/mpeg'")
  })
})
