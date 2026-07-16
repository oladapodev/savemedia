import { allBlogPosts } from '../../.content-collections/generated/index.js'

export type BlogPost = (typeof allBlogPosts)[number]

export const blogPosts: BlogPost[] = [...allBlogPosts].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
)

export const categories = ['downloads', 'quality', 'platforms', 'workflow', 'security'] as const

export function getPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug)
}

export function getRelatedPosts(post: BlogPost, limit = 4) {
  const requested = post.relatedSlugs
    .map((slug) => getPostBySlug(slug))
    .filter((candidate): candidate is BlogPost => Boolean(candidate))

  const fallback = blogPosts.filter(
    (candidate) =>
      candidate.slug !== post.slug &&
      candidate.category === post.category &&
      !requested.some((related) => related.slug === candidate.slug),
  )

  return [...requested, ...fallback].slice(0, limit)
}
