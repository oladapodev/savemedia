import { Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'

import BrandIcon from '@/components/BrandIcon'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'

const navigation = [
  { label: 'Home', to: '/' as const },
  { label: 'Downloader', to: '/downloader' as const },
  { label: 'API Docs', to: '/docs/api' as const },
  { label: 'Privacy Policy', to: '/privacy' as const },
  { label: 'Disclaimer', to: '/disclaimer' as const },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-gray-300">
          <strong className="text-amber-300">Responsible-use notice:</strong>{' '}
          iMediaSave does not grant rights to third-party media. Download only content you own or are authorized to use,
          and follow applicable law and platform terms. See the{' '}
          <Link to="/disclaimer" className="text-amber-300 underline underline-offset-4 hover:text-amber-200">full Disclaimer</Link>.
        </div>

        <div className="grid gap-9 py-10 md:grid-cols-[1fr_0.8fr_1.5fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
                <Download className="h-4.5 w-4.5 text-white" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                iMedia<span className="text-orange-400">Save</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-gray-400">
              Preview and download supported public media links in the formats and qualities made available by the processing service.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-200">Explore</h2>
            <ul className="mt-4 space-y-2.5">
              {navigation.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="inline-flex min-h-8 items-center text-sm text-gray-400 hover:text-orange-300">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/blog"
                  search={{ category: undefined, tag: undefined }}
                  className="inline-flex min-h-8 items-center text-sm text-gray-400 hover:text-orange-300"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-200">Supported platforms</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUPPORTED_PLATFORMS.map((platform) => (
                <span
                  key={platform.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-300"
                >
                  <BrandIcon platform={platform} className="h-4 w-4 shrink-0 rounded bg-white p-0.5" decorative />
                  {platform.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-5 text-xs leading-5 text-gray-500 sm:flex sm:items-start sm:justify-between sm:gap-6">
          <p>&copy; {new Date().getFullYear()} iMediaSave. All rights reserved.</p>
          <p className="mt-2 max-w-2xl sm:mt-0 sm:text-right">
            Platform names and logos belong to their respective owners and are used only to identify supported services.
            iMediaSave is not affiliated with or endorsed by those platforms.
          </p>
        </div>
      </div>
    </footer>
  )
}
