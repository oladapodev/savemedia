import { Link, createFileRoute } from '@tanstack/react-router'
import { LockKeyhole, ShieldCheck } from 'lucide-react'

import { buildSeo } from '@/lib/seo'

const description = 'Read how iMediaSave processes submitted media URLs, technical request information, logs, cookies, and third-party service data.'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head: () => buildSeo({
    title: 'Privacy Policy | iMediaSave',
    description,
    path: '/privacy',
    keywords: ['iMediaSave privacy', 'media downloader privacy', 'submitted URL processing'],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'iMediaSave Privacy Policy',
      description,
    },
  }),
})

const sections = [
  {
    title: 'Information we process',
    content: (
      <>
        <p>When you use the downloader or public API, iMediaSave processes the media URL you submit and the settings needed to preview or prepare the requested file. The service does not require a public user account.</p>
        <p>Servers and infrastructure providers may also process routine technical information such as IP address, browser or user-agent details, timestamps, requested routes, response status, security events, and error diagnostics. A submitted URL may itself contain identifiers supplied by the source platform.</p>
      </>
    ),
  },
  {
    title: 'How information is used',
    content: (
      <>
        <p>Information is used to validate supported links, request source metadata, generate previews, prepare downloads, return API responses, protect the service from abuse, diagnose failures, and maintain reliability.</p>
        <p>iMediaSave does not use submitted links to create public profiles. It does not sell submitted URLs or technical request information.</p>
      </>
    ),
  },
  {
    title: 'Processing services and third parties',
    content: (
      <p>To complete a request, the submitted URL and related request data may be sent to the private media-processing service, the source platform or its delivery network, and infrastructure providers that host or protect iMediaSave. Those providers process information under their own terms and privacy practices. Following a source link or downloading a remotely hosted file may also create a direct request to that third party.</p>
    ),
  },
  {
    title: 'Cookies and browser storage',
    content: (
      <p>The current public interface does not intentionally use advertising cookies, behavioral profiling, or a first-party analytics tracker. Hosting, security, embedded documentation, or future optional features may use essential browser storage or process request identifiers. If that behavior changes materially, this notice should be updated and any legally required consent controls should be added before deployment.</p>
    ),
  },
  {
    title: 'Retention',
    content: (
      <p>iMediaSave does not intentionally place submitted URLs into a permanent user-profile database. URLs and generated responses may remain temporarily in memory, caches, error records, or infrastructure logs for processing, security, debugging, and reliability. Retention depends on the deployment and provider configuration; operators should keep it no longer than reasonably necessary for those purposes.</p>
    ),
  },
  {
    title: 'Security and international processing',
    content: (
      <p>Reasonable technical safeguards are used to separate the public wrapper from private processing credentials. No internet service can guarantee absolute security. Hosting and source-platform providers may process information in countries outside your own, subject to their infrastructure and legal obligations.</p>
    ),
  },
  {
    title: 'Your choices',
    content: (
      <p>You can avoid submitting a URL, stop using the service, or clear local browser data through your browser controls. Depending on applicable law and the operator of the deployment, you may be able to request access, correction, deletion, restriction, or an explanation of personal information held in identifiable logs. Direct privacy requests to the operator responsible for the iMediaSave domain you are using.</p>
    ),
  },
  {
    title: 'Children and sensitive material',
    content: (
      <p>iMediaSave is a general-purpose utility and is not directed to children. Do not submit private, intimate, illegal, or sensitive media, and do not use the service to invade another person&apos;s privacy or safety.</p>
    ),
  },
  {
    title: 'Policy updates',
    content: (
      <p>This notice may be revised when the product, providers, or legal requirements change. The effective date shown on this page identifies the current version. Material changes should be published before or when the changed processing begins.</p>
    ),
  },
]

function PrivacyPage() {
  return (
    <main className="min-h-screen gradient-bg">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Privacy and transparency
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-5xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">{description}</p>
          <p className="mt-4 text-xs font-medium text-gray-400">Effective date: July 13, 2026</p>
        </header>

        <div className="mt-6 space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-950">
                <ShieldCheck className="h-5 w-5 text-orange-600" aria-hidden="true" /> {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-gray-600">{section.content}</div>
            </section>
          ))}
        </div>

        <p className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-600">
          This page explains the product&apos;s current technical behavior; it is not a certification of compliance or legal advice.
          Also review the <Link to="/disclaimer" className="font-semibold text-orange-700 underline underline-offset-4">Disclaimer</Link> before using the service.
        </p>
      </div>
    </main>
  )
}
