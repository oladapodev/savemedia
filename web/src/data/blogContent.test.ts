import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'

const contentRoot = new URL('../../content/blog/', import.meta.url)

type ParsedPost = {
  slug: string
  relatedSlugs: string[]
  body: string
}

function parsePost(path: string, source: string): ParsedPost {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  expect(match, `${path} must contain valid frontmatter`).not.toBeNull()

  const frontmatter = match?.[1] ?? ''
  const body = match?.[2] ?? ''
  const slug = frontmatter.match(/^slug:\s*['"]?([^'"\n]+)['"]?$/m)?.[1]?.trim() ?? ''
  const relatedLine = frontmatter.match(/^relatedSlugs:\s*\[([^\]]*)\]$/m)?.[1] ?? ''
  const relatedSlugs = relatedLine
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  return { slug, relatedSlugs, body }
}

async function readPosts() {
  const posts: ParsedPost[] = []
  const fileNames = await readdir(contentRoot, { withFileTypes: true }).catch(() => [])

  for (const fileName of fileNames) {
    if (!fileName.isFile() || !fileName.name.endsWith('.md')) continue
    const path = new URL(fileName.name, contentRoot).pathname
    posts.push(parsePost(path, await Bun.file(path).text()))
  }

  return posts
}

function countWords(markdown: string) {
  return markdown
    .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
    .replace(/[#>*_`-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

describe('blog content library', () => {
  test('contains at least 20 complete long-form articles', async () => {
    const posts = await readPosts()

    expect(posts.length).toBeGreaterThanOrEqual(20)
    for (const post of posts) {
      expect(post.slug.length).toBeGreaterThan(0)
      expect(countWords(post.body), `${post.slug} is too short`).toBeGreaterThanOrEqual(400)
      expect(countWords(post.body), `${post.slug} is too long`).toBeLessThanOrEqual(1800)
    }
  })

  test('uses unique slugs and valid internal article links', async () => {
    const posts = await readPosts()
    const slugs = new Set(posts.map((post) => post.slug))

    expect(slugs.size).toBe(posts.length)
    for (const post of posts) {
      expect(post.relatedSlugs.length, `${post.slug} needs related reading`).toBeGreaterThanOrEqual(2)
      for (const relatedSlug of post.relatedSlugs) {
        expect(slugs.has(relatedSlug), `${post.slug} links to missing ${relatedSlug}`).toBe(true)
        expect(relatedSlug).not.toBe(post.slug)
      }
    }
  })
})
