import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog')({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === 'string' ? search.category : undefined,
    tag: typeof search.tag === 'string' ? search.tag : undefined,
  }),
  component: BlogLayout,
})

function BlogLayout() {
  return <Outlet />
}
