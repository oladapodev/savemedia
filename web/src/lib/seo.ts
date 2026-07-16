import { absoluteUrl, SITE_NAME, SOCIAL_IMAGE_PATH } from '@/lib/site'

type SeoType = 'website' | 'article'

type SeoInput = {
  title: string
  description: string
  path: string
  type?: SeoType
  imagePath?: string
  keywords?: string[]
  noIndex?: boolean
  publishedAt?: string
  modifiedAt?: string
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}
export function buildSeo({
  title,
  description,
  path,
  type = 'website',
  imagePath = SOCIAL_IMAGE_PATH,
  keywords = [],
  noIndex = false,
  publishedAt,
  modifiedAt,
  jsonLd,
}: SeoInput) {
  const canonical = absoluteUrl(path)
  const image = absoluteUrl(imagePath)
  const meta: Array<Record<string, string>> = [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: type },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: image },
    { property: 'og:image:alt', content: `${SITE_NAME} media downloader` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ]

  if (keywords.length > 0) meta.push({ name: 'keywords', content: keywords.join(', ') })
  if (publishedAt) meta.push({ property: 'article:published_time', content: publishedAt })
  if (modifiedAt) meta.push({ property: 'article:modified_time', content: modifiedAt })

  return {
    meta,
    links: [{ rel: 'canonical', href: canonical }],
    scripts: jsonLd
      ? [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }]
      : [],
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: absoluteUrl('/'),
        description: 'Preview and download supported public media links in available formats and qualities.',
      },
      {
        '@type': 'Organization',
        name: SITE_NAME,
        url: absoluteUrl('/'),
        logo: absoluteUrl(SOCIAL_IMAGE_PATH),
      },
    ],
  }
}
