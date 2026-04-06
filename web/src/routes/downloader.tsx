import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Camera,
  Music,
  Image,
  Play,
  Shield,
  Zap,
  Monitor,
  Headphones,
  Twitter,
  Facebook,
  Download,
} from 'lucide-react'
import DownloaderCard from '@/components/DownloaderCard'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'

export const Route = createFileRoute('/downloader')({
  component: DownloaderPage,
})

const supportedPlatforms = [
  { name: 'TikTok', icon: <Music className="w-4 h-4" />, color: 'from-[#ff0050] to-[#00f2ea]' },
  { name: 'Instagram', icon: <Image className="w-4 h-4" />, color: 'from-purple-600 to-orange-400' },
  { name: 'Snapchat', icon: <Camera className="w-4 h-4" />, color: 'from-yellow-400 to-yellow-500' },
  { name: 'YouTube', icon: <Play className="w-4 h-4" />, color: 'from-red-600 to-red-500' },
  { name: 'Twitter/X', icon: <Twitter className="w-4 h-4" />, color: 'from-blue-400 to-blue-600' },
  { name: 'Facebook', icon: <Facebook className="w-4 h-4" />, color: 'from-blue-600 to-blue-700' },
]

const allPlatformNames = SUPPORTED_PLATFORMS.map((platform) => platform.name)

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
              <span className={`bg-gradient-to-r ${p.color} bg-clip-text text-transparent`}>
                {p.icon}
              </span>
              {p.name}
            </div>
          ))}
        </div>
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
            <p className="text-[10px] text-gray-400 mt-0.5">No data stored</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <Headphones className="w-5 h-5 text-pink-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-700">Audio</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Extract MP3</p>
          </div>
        </div>
      </div>

      {/* Professional Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Download className="w-4.5 h-4.5 text-white" />
                </div>
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  iMedia<span className="text-orange-400">Save</span>
                </span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                Download HD videos and images from your favourite social media platforms. Fast, free, and secure.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3
                className="text-sm font-semibold text-white uppercase tracking-wider mb-4"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Quick Links
              </h3>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/downloader" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">
                    Downloader
                  </Link>
                </li>
              </ul>
            </div>

            {/* Supported Platforms */}
            <div>
              <h3
                className="text-sm font-semibold text-white uppercase tracking-wider mb-4"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Platforms
              </h3>
              <div className="flex flex-wrap gap-2">
                {allPlatformNames.map((p) => (
                  <span key={p} className="px-3 py-1 text-xs rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} iMediaSave. Download responsibly and respect content creators' rights.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
