export const SITE_NAME = 'iMediaSave'
export const DEFAULT_SITE_URL = 'http://localhost:3000'
export const SOCIAL_IMAGE_PATH = '/316E7F74-2C01-4DDC-8DD1-4D7277FB6DF9.png'

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : DEFAULT_SITE_URL
}
export function getSiteUrl() {
  const configuredUrl = typeof process !== 'undefined' ? process.env.PUBLIC_APP_URL : undefined
  return normalizeBaseUrl(configuredUrl || DEFAULT_SITE_URL)
}

export function absoluteUrl(path = '/') {
  const normalizedPath = path === '/' ? '' : `/${path.replace(/^\/+/, '')}`
  return `${getSiteUrl()}${normalizedPath}`
}
