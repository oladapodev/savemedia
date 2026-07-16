import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Tag } from 'lucide-react'
import LegalNotice from '@/components/LegalNotice'
import type { BlogPost } from '@/data/blogPosts'
import { getPostBySlug, getRelatedPosts } from '@/data/blogPosts'
import { buildSeo } from '@/lib/seo'
import { absoluteUrl } from '@/lib/site'

function postHead(post?: BlogPost) {
  if (!post) {
    return buildSeo({
      title: 'Article not found | iMediaSave Blog',
      description: 'Browse practical media download and creator workflow guides.',
      path: '/blog',
      noIndex: true,
    })
  }

  return buildSeo({
    title: post.metaTitle,
    description: post.metaDescription,
    path: `/blog/${post.slug}`,
    type: 'article',
    keywords: post.tags,
    publishedAt: post.publishedAt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.metaDescription,
      datePublished: post.publishedAt,
      mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
      author: { '@type': 'Organization', name: 'iMediaSave' },
      publisher: { '@type': 'Organization', name: 'iMediaSave' },
      keywords: post.tags.join(', '),
      wordCount: post.wordCount,
    },
  })
}

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = getPostBySlug(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => postHead(loaderData),
  notFoundComponent: ArticleNotFound,
  component: BlogPostPage,
})

function ArticleNotFound() {
  return (
    <main className="min-h-screen gradient-bg flex items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-950">Article not found</h1>
        <p className="mt-2 text-sm text-gray-600">That guide may have moved or the link may be incomplete.</p>
        <Link to="/blog" search={{ category: undefined, tag: undefined }} className="inline-flex mt-5 text-sm font-semibold text-orange-700">Browse all articles</Link>
      </div>
    </main>
  )
}

function BlogPostPage() {
  const post = Route.useLoaderData()
  const related = getRelatedPosts(post)

  return (
    <main className="min-h-screen gradient-bg">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link to="/blog" search={{ category: undefined, tag: undefined }} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all guides
        </Link>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-sm">
          <header className="border-b border-gray-100 pb-8">
            <Link to="/blog" search={{ category: post.category, tag: undefined }} className="text-xs font-semibold text-orange-700 uppercase tracking-widest hover:text-orange-800">
              {post.category}
            </Link>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-950 leading-tight mt-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {post.title}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mt-4 leading-relaxed">{post.excerpt}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-5">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{new Date(post.publishedAt).toDateString()}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4" />{post.readMinutes} min read</span>
              <span>{post.wordCount} words</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {post.tags.map((tag) => (
                <Link key={tag} to="/blog" search={{ category: undefined, tag }} className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-xs text-gray-600 hover:border-orange-200 hover:text-orange-700">
                  <Tag className="w-3.5 h-3.5" />{tag}
                </Link>
              ))}
            </div>
          </header>

          <div className="mt-8">
            <LegalNotice compact title="Educational guide and responsible use" />
          </div>

          <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.html }} />

          <section className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-orange-50/60 border border-orange-100 p-5">
              <h2 className="font-bold text-gray-950">Key takeaways</h2>
              <ul className="space-y-3 mt-3">
                {post.takeaways.map((item) => (
                  <li key={item} className="text-sm text-gray-700 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
              <h2 className="font-bold text-gray-950">Action checklist</h2>
              <ol className="space-y-3 mt-3">
                {post.checklist.map((step, index) => (
                  <li key={step} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-white border border-gray-200 text-xs flex items-center justify-center shrink-0">{index + 1}</span>{step}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        <aside className="mt-8">
          <h2 className="text-2xl font-bold text-gray-950">Continue reading</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {related.map((item) => (
              <Link key={item.slug} to="/blog/$slug" params={{ slug: item.slug }} search={{ category: undefined, tag: undefined }} preload="intent" className="rounded-2xl bg-white border border-gray-100 p-5 hover:border-orange-200 hover:shadow-sm transition-all">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">{item.category}</p>
                <h3 className="font-bold text-gray-950 leading-snug mt-2">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.excerpt}</p>
                <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-orange-700">Read next <ArrowRight className="w-4 h-4" /></span>
              </Link>
            ))}
          </div>
        </aside>
      </article>
    </main>
  )
}
