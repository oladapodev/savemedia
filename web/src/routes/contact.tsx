import { createFileRoute } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { buildSeo } from '@/lib/seo'

const description = 'Contact the operator of this iMediaSave deployment for product support or rights concerns.'
export const Route = createFileRoute('/contact')({
  component: ContactPage,
  head: () => buildSeo({ title: 'Contact Us | iMediaSave', description, path: '/contact', keywords: ['iMediaSave contact', 'iMediaSave support'] }),
})

function ContactPage() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim()
  return <main className="min-h-screen bg-white"><div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
    <div className="rounded-2xl border border-gray-200 p-6 sm:p-9"><Mail className="h-8 w-8 text-orange-600" />
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-950">Contact Us</h1><p className="mt-4 leading-7 text-gray-600">{description}</p>
      {supportEmail ? <a className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-orange-700 px-5 font-semibold text-white"
        href={`mailto:${supportEmail}?subject=iMediaSave%20support`}>Email {supportEmail}</a>
        : <p className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">A support email has not been configured for this deployment yet. Please use the Help Center, Privacy Policy, or Disclaimer for available guidance.</p>}
    </div>
  </div></main>
}
