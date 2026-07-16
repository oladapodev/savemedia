export const CONCRETE_DOWNLOAD_MIME_BY_EXTENSION = {
  gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
} as const

export type ConcreteDownloadMime = (typeof CONCRETE_DOWNLOAD_MIME_BY_EXTENSION)[keyof typeof CONCRETE_DOWNLOAD_MIME_BY_EXTENSION]

const supported = new Set<ConcreteDownloadMime>(Object.values(CONCRETE_DOWNLOAD_MIME_BY_EXTENSION))

function normalizedContentType(value: string | undefined): ConcreteDownloadMime | null {
  const normalized = value?.split(';', 1)[0]?.trim().toLowerCase() as ConcreteDownloadMime | undefined
  return normalized && supported.has(normalized) ? normalized : null
}

function extension(value: string): keyof typeof CONCRETE_DOWNLOAD_MIME_BY_EXTENSION | null {
  try {
    const path = value.includes('://') ? new URL(value).pathname : value
    const suffix = decodeURIComponent(path).match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
    return suffix && suffix in CONCRETE_DOWNLOAD_MIME_BY_EXTENSION
      ? suffix as keyof typeof CONCRETE_DOWNLOAD_MIME_BY_EXTENSION
      : null
  } catch {
    return null
  }
}

export function concreteDownloadMime(input: {
  filename: string
  url: string
  contentType?: string
  quality?: string
  pickerType?: string
}): ConcreteDownloadMime | null {
  if (input.quality === 'audio') return 'audio/mpeg'
  const declared = normalizedContentType(input.contentType)
  if (declared) return declared
  for (const value of [input.filename, input.url]) {
    const suffix = extension(value)
    if (suffix) return CONCRETE_DOWNLOAD_MIME_BY_EXTENSION[suffix]
  }
  if (input.pickerType === 'photo') return 'image/jpeg'
  if (input.pickerType === 'gif') return 'image/gif'
  if (input.pickerType === 'video') return 'video/mp4'
  return null
}

export function extensionForConcreteDownloadMime(mimeType: ConcreteDownloadMime): string {
  const canonical: Record<ConcreteDownloadMime, string> = {
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
    'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  }
  return canonical[mimeType]
}

export function filenameForConcreteDownloadMime(filename: string, mimeType: ConcreteDownloadMime): string {
  const leaf = filename.replace(/^.*[\\/]/, '').trim()
  const stem = leaf.replace(/\.[a-zA-Z0-9]+$/, '').trim() || 'media'
  return `${stem}.${extensionForConcreteDownloadMime(mimeType)}`
}
