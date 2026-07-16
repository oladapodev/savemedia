import { Link } from '@tanstack/react-router'
import { Scale } from 'lucide-react'

type LegalNoticeProps = {
  title?: string
  children?: React.ReactNode
  compact?: boolean
}
export default function LegalNotice({
  title = 'Download responsibly',
  children,
  compact = false,
}: LegalNoticeProps) {
  return (
    <aside
      aria-label="Responsible use notice"
      className={`rounded-2xl border border-amber-200 bg-amber-50/80 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
          <Scale className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
          <div className="mt-1 text-xs leading-5 text-gray-600 sm:text-sm">
            {children ?? (
              <p>
                Only download or process media you own, that is public domain, or that you have permission or a legal right to use.
                You remain responsible for copyright, privacy, and the source platform&apos;s terms.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
            <Link to="/disclaimer" className="text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950">
              Read the Disclaimer
            </Link>
            <Link to="/privacy" className="text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950">
              Read the Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}
