import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, Lock, Server, Sparkles } from 'lucide-react'

import ScalarApiReference from '@/components/ScalarApiReference'

export const Route = createFileRoute('/docs/api')({
  component: ApiDocsPage,
  head: () => ({
    meta: [
      {
        title: 'iMediaSave API Docs',
      },
      {
        name: 'description',
        content:
          'Interactive API documentation for the iMediaSave wrapper API, including preview, download, and proxy endpoints.',
      },
    ],
  }),
})

const callouts = [
  {
    icon: <Sparkles className="h-4 w-4 text-orange-500" />,
    title: 'Public Wrapper API',
    copy: 'These endpoints are the stable iMediaSave contract. Clients should integrate with iMediaSave routes and not depend on private backend implementation details.',
  },
  {
    icon: <Lock className="h-4 w-4 text-emerald-500" />,
    title: 'Auth Expectations',
    copy: 'The public wrapper routes currently do not require client auth. Private service-to-service credentials are handled on the backend when needed.',
  },
  {
    icon: <Server className="h-4 w-4 text-amber-500" />,
    title: 'Cloud Run Ready',
    copy: 'The web app and media processing service can run as separate Cloud Run services so UI traffic and heavier processing workloads scale independently.',
  },
]

function ApiDocsPage() {
  return (
    <div className="gradient-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 rounded-[32px] border border-orange-100 bg-white/90 p-6 shadow-xl shadow-orange-500/5 backdrop-blur sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600">
            <BookOpen className="h-3.5 w-3.5" />
            iMediaSave Developer Docs
          </div>

          <h1
            className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            API docs for the <span className="text-orange-500">iMediaSave</span> wrapper API
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-500 sm:text-base">
            Use the public iMediaSave endpoints to preview supported media, request download links, and proxy file downloads.
            The API reference below documents the wrapper routes your clients should depend on, while backend processing stays
            private behind the scenes.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {callouts.map((callout) => (
              <div
                key={callout.title}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                  {callout.icon}
                </div>
                <h2 className="text-sm font-semibold text-gray-900">{callout.title}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">{callout.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <ScalarApiReference />
      </div>
    </div>
  )
}
