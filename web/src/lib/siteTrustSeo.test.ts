import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { blogPosts } from '@/data/blogPosts'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'

const webRoot = resolve(import.meta.dir, '../..')

async function read(relativePath: string) {
  return Bun.file(resolve(webRoot, relativePath)).text()
}

describe('site trust and SEO surface', () => {
  test('every supported platform has a local SVG brand icon', async () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      expect(platform.iconPath, `${platform.name} needs an icon path`).toMatch(/^\/platform-logos\/.+\.svg$/)
      const iconFile = resolve(webRoot, 'public', platform.iconPath.slice(1))
      expect(await Bun.file(iconFile).exists(), `${platform.name} icon is missing`).toBe(true)
    }
  })

  test('privacy and disclaimer routes contain complete public notices', async () => {
    const privacy = await read('src/routes/privacy.tsx')
    const disclaimer = await read('src/routes/disclaimer.tsx')

    for (const section of ['Information we process', 'How information is used', 'Retention', 'Your choices']) {
      expect(privacy).toContain(section)
    }
    for (const section of ['Responsible use', 'Copyright', 'No affiliation', 'No warranties']) {
      expect(disclaimer).toContain(section)
    }
  })

  test('shared layout and contextual pages expose legal notices', async () => {
    const root = await read('src/routes/__root.tsx')
    const docs = await read('src/routes/docs.api.tsx')
    const article = await read('src/routes/blog.$slug.tsx')

    expect(root).toContain('<SiteFooter />')
    expect(docs).toContain('<LegalNotice')
    expect(article).toContain('<LegalNotice')
  })

  test('the unrelated stock product route is excluded from search indexing', async () => {
    const productRoute = await read('src/routes/products/$productId.tsx')
    expect(productRoute).toContain('noIndex: true')
  })

  test('blog index SEO stays on the index route so articles have one canonical', async () => {
    const blogLayout = await read('src/routes/blog.tsx')
    const blogIndex = await read('src/routes/blog.index.tsx')

    expect(blogLayout).not.toContain('buildSeo({')
    expect(blogIndex).toContain("path: '/blog'")
  })

  test('SEO helper includes canonical and social metadata', async () => {
    const seoModule = await import('@/lib/seo').catch(() => undefined)
    expect(seoModule, 'SEO helper module must exist').toBeDefined()

    const seo = seoModule!.buildSeo({
      title: 'Example page',
      description: 'Example description',
      path: '/example',
      type: 'article',
    })

    expect(seo.links).toContainEqual({ rel: 'canonical', href: 'http://localhost:3000/example' })
    expect(seo.meta).toContainEqual({ property: 'og:url', content: 'http://localhost:3000/example' })
    expect(seo.meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
  })

  test('sitemap and robots helpers include crawl discovery', async () => {
    const sitemapModule = await import('@/lib/sitemap').catch(() => undefined)
    expect(sitemapModule, 'sitemap helper module must exist').toBeDefined()

    const xml = sitemapModule!.buildSitemapXml()
    expect(xml).toContain('<loc>http://localhost:3000/privacy</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/disclaimer</loc>')
    for (const post of blogPosts) {
      expect(xml).toContain(`<loc>http://localhost:3000/blog/${post.slug}</loc>`)
    }

    const robots = sitemapModule!.buildRobotsTxt()
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Sitemap: http://localhost:3000/sitemap.xml')
  })
})
