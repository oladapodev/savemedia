import { Link, createFileRoute } from '@tanstack/react-router'
import { CircleHelp, Download, Share2 } from 'lucide-react'
import { buildSeo } from '@/lib/seo'

const description = 'Learn how to preview, download, find, share, and manage supported media with iMediaSave.'
export const Route = createFileRoute('/help')({
  component: HelpPage,
  head: () => buildSeo({ title: 'Help Center | iMediaSave', description, path: '/help', keywords: ['iMediaSave help', 'media download help'] }),
})

function HelpPage() {
  return <main className="min-h-screen bg-white"><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <header><div className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600"><CircleHelp className="h-5 w-5" /> Help Center</div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">Using iMediaSave</h1><p className="mt-3 leading-7 text-gray-600">{description}</p></header>
    <div className="mt-10 space-y-4">
      <section className="rounded-2xl border border-gray-200 p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><Download className="h-5 w-5 text-orange-600" /> Preview and download</h2>
        <p className="mt-3 leading-7 text-gray-600">Copy a supported public link, tap Paste, review the real preview and quality, then start the download. Private, deleted, restricted, or unsupported media may not be available.</p></section>
      <section className="rounded-2xl border border-gray-200 p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><Share2 className="h-5 w-5 text-orange-600" /> Share into the app</h2>
        <p className="mt-3 leading-7 text-gray-600">Use your platform&apos;s Share menu and choose iMediaSave. Auto download applies only to shared links when enabled in Settings.</p></section>
      <section className="rounded-2xl border border-gray-200 p-6"><h2 className="text-xl font-bold">Downloads and History</h2>
        <p className="mt-3 leading-7 text-gray-600">Downloads shows active work. History stores completed, failed, and cancelled activity locally on your device. You can retry eligible failures or remove records and device files.</p></section>
    </div>
    <p className="mt-8 text-sm text-gray-600">Need more help? Visit <Link to="/contact" className="font-semibold text-orange-700 underline">Contact Us</Link>.</p>
  </div></main>
}
