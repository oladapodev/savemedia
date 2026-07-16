import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BookOpenText, CalendarDays, Clock3, Tag } from 'lucide-react'
import { blogPosts, categories } from '@/data/blogPosts'
import { buildSeo } from '@/lib/seo'

function categoryCounts() {
  return categories.map((category) => [
    category,
    blogPosts.filter((post) => post.category === category).length,
  ] as const)
}

function popularTags() {
  const counts = new Map<string, number>()
  for (const post of blogPosts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12)
}

export const Route = createFileRoute('/blog/')({
  component: BlogIndex,
  head: () => buildSeo({
    title: 'iMediaSave Blog | Practical Media Download Guides',
    description: 'Detailed guides for downloading, organizing, and preparing social media files with better quality, safer workflows, and less wasted time.',
    path: '/blog',
    keywords: ['social media download guides', 'video quality guide', 'organize downloaded media', 'audio extraction', 'creator workflow'],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'iMediaSave Blog',
      description: 'Practical media download, quality, platform, workflow, and security guides.',
    },
  }),
})

function BlogIndex() {
  const search = Route.useSearch()
  const filteredPosts = blogPosts.filter((post) => {
    const matchesCategory = !search.category || post.category === search.category
    const matchesTag = !search.tag || post.tags.includes(search.tag)
    return matchesCategory && matchesTag
  })

  const activeFilter = search.tag ? `Tagged “${search.tag}”` : search.category ? `${search.category} guides` : 'All guides'

  return (
    <main className="min-h-screen gradient-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <header className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-medium text-orange-700 mb-4">
            <BookOpenText className="w-3.5 h-3.5" />
            iMediaSave Blog
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-950 leading-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Practical guides for better media workflows
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
            Learn how to choose file quality, organize downloads, handle platform links, and build a cleaner creator workflow. Every guide is written as a complete, useful article.
          </p>
        </header>

        <section aria-label="Filter articles" className="mb-9 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link
              to="/blog"
              search={{ category: undefined, tag: undefined }}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                !search.category && !search.tag
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'
              }`}
            >
              All ({blogPosts.length})
            </Link>
            {categoryCounts().map(([category, count]) => (
              <Link
                key={category}
                to="/blog"
                search={{ category, tag: undefined }}
                className={`rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  search.category === category && !search.tag
                    ? 'border-orange-300 bg-orange-50 text-orange-800'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'
                }`}
              >
                {category} ({count})
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400 mr-1">
              <Tag className="w-3.5 h-3.5" /> Tags
            </span>
            {popularTags().map(([tag]) => (
              <Link
                key={tag}
                to="/blog"
                search={{ category: undefined, tag }}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  search.tag === tag ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:text-orange-700'
                }`}
              >
                {tag}
              </Link>
            ))}
          </div>
        </section>

        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">{activeFilter}</p>
            <h2 className="text-2xl font-bold text-gray-950 mt-1">{filteredPosts.length} articles</h2>
          </div>
          {(search.category || search.tag) && (
            <Link to="/blog" search={{ category: undefined, tag: undefined }} className="text-sm text-orange-700 hover:text-orange-800">
              Clear filter
            </Link>
          )}
        </div>

        <section className="grid gap-5 md:grid-cols-2" aria-label="Blog articles">
          {filteredPosts.map((post) => (
            <article key={post.slug} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:border-orange-200 hover:shadow-md transition-all">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 uppercase tracking-wider mb-3">
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{new Date(post.publishedAt).toDateString()}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{post.readMinutes} min</span>
                <span className="text-orange-600">{post.category}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-950 leading-snug" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <Link to="/blog/$slug" params={{ slug: post.slug }} search={{ category: undefined, tag: undefined }} preload="intent" className="hover:text-orange-700 transition-colors">
                  {post.title}
                </Link>
              </h3>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">{post.excerpt}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {post.tags.slice(0, 3).map((tag) => (
                  <Link key={tag} to="/blog" search={{ category: undefined, tag }} className="rounded-md bg-gray-50 border border-gray-100 px-2 py-1 text-xs text-gray-500 hover:border-orange-200 hover:text-orange-700">
                    {tag}
                  </Link>
                ))}
              </div>
              <Link to="/blog/$slug" params={{ slug: post.slug }} search={{ category: undefined, tag: undefined }} preload="intent" className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-orange-700 hover:text-orange-800">
                Read full guide <ArrowRight className="w-4 h-4" />
              </Link>
            </article>
          ))}
        </section>

        {filteredPosts.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">
            No articles match this filter.{' '}
            <Link to="/blog" search={{ category: undefined, tag: undefined }} className="text-orange-700">View every guide.</Link>
          </div>
        )}
      </div>
    </main>
  )
}
