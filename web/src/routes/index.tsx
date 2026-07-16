import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Download,
  Camera,
  Music,
  Image,
  ArrowRight,
  Clock3,
  Eye,
  Gauge,
  Zap,
  Globe,
  Play,
  Monitor,
  Headphones,
  Sparkles,
  CheckCircle2,
  Users,
  ShieldCheck,
} from 'lucide-react'
import BrandIcon from '@/components/BrandIcon'
import { getPlatform, SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { buildSeo, websiteJsonLd } from '@/lib/seo'
import type { ReactNode } from 'react'

export const Route = createFileRoute('/')({
  component: HomePage,
  head: () => buildSeo({
    title: 'iMediaSave — HD Video and Image Downloader',
    description: 'Preview and download supported public videos, images, and audio in available HD formats from TikTok, Instagram, YouTube, X, and more.',
    path: '/',
    keywords: ['video downloader', 'image downloader', 'social media downloader', 'HD media download'],
    jsonLd: websiteJsonLd(),
  }),
})

type PlatformFeature = {
  name: string
  desc: string
  icon: ReactNode
  gradient: string
}

type Feature = {
  icon: ReactNode
  title: string
  desc: string
  color: string
}

type ProcessStep = {
  step: string
  title: string
  desc: string
}

type UseCase = {
  title: string
  desc: string
}

type PlatformFeatureItem = PlatformFeature & { id: string }

const platforms: PlatformFeatureItem[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    desc: 'Download clips, stories, and music exports without extra steps or ads.',
    icon: <Music className="w-6 h-6 text-white" />,
    gradient: 'from-[#ff0050] to-[#00f2ea]',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    desc: 'Save Reels, posts, carousels, and IGTV for offline collections.',
    icon: <Image className="w-6 h-6 text-white" />,
    gradient: 'from-purple-600 via-pink-500 to-orange-400',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    desc: 'Pull moments from Stories, spotlights, and public media links with quality options.',
    icon: <Camera className="w-6 h-6 text-white" />,
    gradient: 'from-yellow-400 to-yellow-500',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    desc: 'Get single videos or shorts with stable links and selectable formats.',
    icon: <Play className="w-6 h-6 text-white" />,
    gradient: 'from-red-600 to-red-500',
  },
]

function PlatformLogo({ platformId, className = 'w-6 h-6' }: { platformId: string; className?: string }) {
  const platform = getPlatform(platformId)
  if (!platform) return null

  return <BrandIcon platform={platform} className={className} decorative monochrome />
}

const features: Feature[] = [
  {
    icon: <Monitor className="w-5 h-5" />,
    title: 'HD & 4K Quality',
    desc: 'Get the best stream available for each post, including HD and up to 4K options where the source permits.',
    color: 'text-orange-500',
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Content Preview',
    desc: 'Preview your selected item first, confirm the exact content, then save only what you need.',
    color: 'text-amber-500',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Lightning Fast',
    desc: 'Paste a link once and quickly get ready-to-download media with minimal waiting time.',
    color: 'text-yellow-500',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Private by Design',
    desc: 'No account is required, and your pasted links are not kept in a public profile.',
    color: 'text-emerald-500',
  },
  {
    icon: <Headphones className="w-5 h-5" />,
    title: 'Audio Extract',
    desc: 'Save soundtrack-heavy clips by extracting audio in a clean MP3 output.',
    color: 'text-pink-500',
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: `${SUPPORTED_PLATFORMS.length}+ Supported Services`,
    desc: 'TikTok, Instagram, YouTube, Snapchat, Reddit, SoundCloud, Vimeo, Twitch, and continuously expanding support.',
    color: 'text-blue-500',
  },
]

const useCases: UseCase[] = [
  {
    title: 'Research & Study',
    desc: 'Store reference media for learning, training, or offline review.',
  },
  {
    title: 'Creative Production',
    desc: 'Collect visual references, trends, and music snippets for inspiration pipelines.',
  },
  {
    title: 'Backup & Archival',
    desc: 'Keep important clips and posts available even when originals are removed.',
  },
]

const processSteps: ProcessStep[] = [
  {
    step: '01',
    title: 'Paste a public share link',
    desc: 'Copy the link from any supported platform and send it to iMediaSave.',
  },
  {
    step: '02',
    title: 'Preview and choose settings',
    desc: 'Review media metadata, select the format, file type, and quality you want.',
  },
  {
    step: '03',
    title: 'Download in seconds',
    desc: 'Use the direct button to fetch your file and save it locally immediately.',
  },
]

type TrustSignal = {
  icon: ReactNode
  title: string
  desc: string
  color: string
}

const trustSignals: TrustSignal[] = [
  {
    icon: <Gauge className="w-5 h-5" />,
    title: 'Fast processing',
    desc: 'Optimized workflow for quick fetch and conversion.',
    color: 'text-emerald-500',
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: 'Preview first',
    desc: 'Confirm the exact content before final download.',
    color: 'text-blue-500',
  },
  {
    icon: <Clock3 className="w-5 h-5" />,
    title: 'Built for speed',
    desc: 'Minimal clicks from link to file.',
    color: 'text-amber-500',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'No sign-up',
    desc: 'Use instantly without creating an account.',
    color: 'text-purple-500',
  },
]

function HomePage() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-1/3 w-96 h-96 bg-orange-200/30 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-72 h-72 bg-amber-200/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-orange-100/20 rounded-full blur-[80px]" />
        </div>

      <div className="relative max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-sm font-medium text-orange-600 mb-8">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Free HD Video & Image Downloader built for everyday creators
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-5 leading-tight tracking-tight"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Download anything from
            <br />
            <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              social media in one click
            </span>
          </h1>

          <p className="text-lg text-gray-500 mb-4 max-w-2xl mx-auto leading-relaxed">
            iMediaSave is a clean, brand-neutral downloader built on a privacy-aware flow.
            Paste any supported link, preview the media first, select quality and format, then
            download instantly without signing up.
          </p>

          <p className="text-sm text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Designed for creators, students, and teams who prefer speed, control, and no account
            friction.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/downloader"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/25 text-sm"
            >
              Start Downloading
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                No sign-up
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                100% free
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                HD quality
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Platforms */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">
            Supported Platforms
          </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {platforms.map((p) => (
            <Link
              key={p.name}
              to="/downloader"
              className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all hover:-translate-y-1"
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center mb-3.5 shadow-lg`}
              >
                <PlatformLogo platformId={p.id} className="w-5 h-5 object-contain" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                {p.name}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
            </Link>
            ))}
        </div>

        <div className="mt-10 text-sm text-gray-500">
          iMediaSave works with links from TikTok, Instagram, YouTube, Snapchat, Reddit, SoundCloud,
          Vimeo, Twitch, and more.
        </div>
      </div>

      {/* How It Works */}
      <div className="border-y border-gray-100 bg-white/60">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <h2
            className="text-2xl font-bold text-gray-900 text-center mb-12"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {processSteps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200 text-orange-600 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Signals */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
          <h2
            className="text-2xl font-bold text-gray-900 text-center mb-8"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Quick Value Signals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustSignals.map((signal) => (
              <div key={signal.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className={`${signal.color} mb-2`}><span aria-hidden="true">{signal.icon}</span></div>
                <h3 className="font-semibold text-sm text-gray-900 mb-1">{signal.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{signal.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-12"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Why people use iMediaSave
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-5 border border-gray-100 hover:border-orange-100 hover:shadow-md transition-all">
              <div className={`${f.color} mb-3`}>{f.icon}</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Use Cases */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-r from-orange-50 via-white to-amber-50 rounded-2xl border border-orange-100 p-6 sm:p-8">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <h2
              className="text-2xl font-bold text-gray-900"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Use cases that fit the real workflow
            </h2>
            <p className="text-sm text-gray-500 mt-3">
              Add links directly from your browser or notes app and pull down the files you actually need.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {useCases.map((useCase) => (
              <article key={useCase.title} className="rounded-xl bg-white border border-orange-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{useCase.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 sm:p-10 text-center shadow-xl shadow-orange-500/20">
          <h2
            className="text-xl sm:text-2xl font-bold text-white mb-3"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Ready to download faster and cleaner?
          </h2>
          <p className="text-sm text-white/80 mb-6 max-w-md mx-auto">
            No registration required. Paste your link and save available content in your preferred
            quality and format.
          </p>
          <Link
            to="/downloader"
            className="inline-flex items-center gap-2 bg-white text-orange-600 px-8 py-3.5 rounded-xl font-semibold hover:bg-orange-50 transition-all active:scale-[0.98] text-sm shadow-lg"
          >
            <Download className="w-4 h-4" />
            Open Downloader
          </Link>
        </div>
      </div>

    </div>
  )
}
