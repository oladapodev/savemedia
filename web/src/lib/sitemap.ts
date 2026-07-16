import { blogPosts } from '@/data/blogPosts'
import { absoluteUrl } from '@/lib/site'

const staticPages = ['/', '/downloader', '/docs/api', '/blog', '/privacy', '/disclaimer']

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] ?? character)
}
export function buildSitemapXml() {
  const staticEntries = staticPages.map((path) => ({
    location: absoluteUrl(path),
    lastModified: '2026-07-13',
  }))
  const articleEntries = blogPosts.map((post) => ({
    location: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.publishedAt,
  }))

  const entries = [...staticEntries, ...articleEntries]
    .map(({ location, lastModified }) => `  <url>\n    <loc>${escapeXml(location)}</loc>\n    <lastmod>${lastModified}</lastmod>\n  </url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

export function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
}
