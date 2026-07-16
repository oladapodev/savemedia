import { Link, createFileRoute } from '@tanstack/react-router'
import { BadgeAlert, Scale } from 'lucide-react'

import { buildSeo } from '@/lib/seo'

const description = 'Read the iMediaSave responsible-use, copyright, trademark, platform affiliation, API, availability, and warranty disclaimer.'

export const Route = createFileRoute('/disclaimer')({
  component: DisclaimerPage,
  head: () => buildSeo({
    title: 'Disclaimer and Responsible Use | iMediaSave',
    description,
    path: '/disclaimer',
    keywords: ['iMediaSave disclaimer', 'responsible media downloading', 'copyright downloader notice'],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'iMediaSave Disclaimer and Responsible Use',
      description,
    },
  }),
})

const sections = [
  {
    title: 'Responsible use',
    body: 'Use iMediaSave only for media you created, own, have permission to download, that is in the public domain, or that applicable law otherwise allows you to use. Do not use the service to bypass access controls, paywalls, digital rights management, privacy settings, or geographic restrictions. You are responsible for checking the law and the source platform terms that apply to your use.',
  },
  {
    title: 'Copyright and other rights',
    body: 'The ability to access or download a file does not transfer copyright, publicity, privacy, contractual, or other rights. Give appropriate attribution when required, do not republish protected work without permission, and do not present another person’s work as your own. Rights owners should contact the operator of the specific iMediaSave deployment with the source URL and a clear description of the concern.',
  },
  {
    title: 'No affiliation or endorsement',
    body: 'iMediaSave is an independent utility and is not affiliated with, sponsored by, approved by, or endorsed by TikTok, Instagram, YouTube, Snapchat, Facebook, X, or any other supported platform. Platform names, icons, logos, and trademarks belong to their respective owners and are shown only to identify compatibility.',
  },
  {
    title: 'Third-party content and services',
    body: 'iMediaSave does not control the accuracy, legality, safety, availability, or continued hosting of third-party media. Source platforms, delivery networks, processing providers, and destination applications may apply their own terms, restrictions, logging, rate limits, or removal policies. A link that works now may later expire or become unavailable.',
  },
  {
    title: 'API use',
    body: 'API clients must validate their inputs, protect returned download URLs, respect rate and resource limits, and comply with applicable law and platform terms. Public wrapper endpoints may change, reject unsupported requests, or become temporarily unavailable. API access does not grant a license to third-party content.',
  },
  {
    title: 'No warranties',
    body: 'The service is provided on an “as available” basis without promises that every platform, link, quality, format, metadata field, or download will work. To the maximum extent permitted by applicable law, no warranty is made regarding uninterrupted operation, fitness for a particular purpose, accuracy, non-infringement, or freedom from errors or harmful third-party content.',
  },
  {
    title: 'Limitation and user responsibility',
    body: 'You remain responsible for submitted URLs, downloaded files, storage, sharing, publication, and any consequences of your use. To the maximum extent permitted by law, the service operator is not responsible for losses caused by third-party content, expired links, platform changes, misuse, interrupted availability, or decisions made from generated metadata.',
  },
  {
    title: 'Not legal advice and changes',
    body: 'This notice provides general product information and is not legal advice. Laws vary by location and circumstance, so obtain qualified advice when needed. This disclaimer may be updated as the service, providers, or legal requirements change.',
  },
]

function DisclaimerPage() {
  return (
    <main className="min-h-screen gradient-bg">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Rights and responsibilities
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-5xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Disclaimer and Responsible Use
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">{description}</p>
          <p className="mt-4 text-xs font-medium text-gray-400">Effective date: July 13, 2026</p>
        </header>

        <div className="mt-6 space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-950">
                <BadgeAlert className="h-5 w-5 text-orange-600" aria-hidden="true" /> {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-600">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-600">
          By continuing to use the service, you acknowledge these responsibilities. Read the{' '}
          <Link to="/privacy" className="font-semibold text-orange-700 underline underline-offset-4">Privacy Policy</Link>{' '}
          to understand how requests are processed.
        </p>
      </div>
    </main>
  )
}
