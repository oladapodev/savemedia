import { createFileRoute } from '@tanstack/react-router'
import {
  Shield,
  Zap,
  Monitor,
  Headphones,
} from 'lucide-react'
import BrandIcon from '@/components/BrandIcon'
import DownloaderCard from '@/components/DownloaderCard'
import LegalNotice from '@/components/LegalNotice'
import { SUPPORTED_PLATFORMS, type SupportedPlatform } from '@/lib/platforms'
import { buildSeo } from '@/lib/seo'

export const Route = createFileRoute('/downloader')({
  component: DownloaderPage,
  head: () => buildSeo({
    title: 'Social Media Downloader | Preview and Save HD Media',
    description: 'Paste a supported public media link, preview the result, choose an available quality or format, and download it with iMediaSave.',
    path: '/downloader',
    keywords: ['social media downloader', 'HD video downloader', 'download public media', 'audio extraction'],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'iMediaSave Downloader',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      description: 'Preview and download supported public media links in available formats.',
    },
  }),
})

const supportedPlatformIds = ['tiktok', 'instagram', 'snapchat', 'youtube', 'twitter', 'facebook'] as const

const supportedPlatforms = supportedPlatformIds
  .map((platformId) => SUPPORTED_PLATFORMS.find((platform) => platform.id === platformId))
  .filter((platform): platform is SupportedPlatform => Boolean(platform))

function PlatformIcon({ platform }: { platform: SupportedPlatform }) {
  return <BrandIcon platform={platform} className="h-4 w-4" />
}

function DownloaderPage() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-orange-200/30 rounded-full blur-[100px]" />
          <div className="absolute top-40 right-1/4 w-48 h-48 bg-amber-200/20 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-medium text-orange-600 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {SUPPORTED_PLATFORMS.length}+ platforms supported • HD quality
          </div>

          <h1
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Download in{' '}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              HD Quality
            </span>
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-lg mx-auto mb-8">
            Paste any supported social media link. Preview the content. Choose your quality. Download instantly.
          </p>
        </div>
      </div>

      {/* Downloader Card */}
      <div className="relative px-4 pb-8">
        <DownloaderCard />
      </div>

      {/* Supported Platforms */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {supportedPlatforms.map((p) => (
            <div
              key={p.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 text-xs font-medium text-gray-500"
            >
              <PlatformIcon platform={p} />
              {p.name}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-8">
        <LegalNotice compact />
      </div>

      {/* Features Grid */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <Monitor className="w-5 h-5 text-orange-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-700">Up to 4K</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Ultra HD quality</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-700">Fast</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Instant processing</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <Shield className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-700">Private</p>
            <p className="text-[10px] text-gray-400 mt-0.5">No account required</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <Headphones className="w-5 h-5 text-pink-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-700">Audio</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Extract MP3</p>
          </div>
        </div>
      </div>

    </div>
  )
}
