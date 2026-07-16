import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMarkdown } from '@content-collections/markdown'
import { z } from 'zod'

const blogPosts = defineCollection({
  name: 'blogPosts',
  directory: 'content/blog',
  include: '*.md',
  schema: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    metaTitle: z.string().min(1),
    metaDescription: z.string().min(1),
    excerpt: z.string().min(1),
    category: z.enum(['downloads', 'quality', 'platforms', 'workflow', 'security']),
    publishedAt: z.string().date(),
    tags: z.array(z.string()).min(2),
    relatedSlugs: z.array(z.string()).min(2),
    takeaways: z.array(z.string()).min(3),
    checklist: z.array(z.string()).min(3),
    content: z.string(),
  }),
  transform: async (post, context) => {
    const html = await compileMarkdown(context, post)
    const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length

    return {
      ...post,
      html,
      wordCount,
      readMinutes: Math.max(2, Math.ceil(wordCount / 220)),
    }
  },
})

export default defineConfig({ content: [blogPosts] })
