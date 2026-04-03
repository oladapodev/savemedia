import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Download,
  Camera,
  Music,
  Image,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Play,
  Monitor,
  Headphones,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const platforms = [
  {
    name: 'TikTok',
    desc: 'Videos, slideshows, and music without watermarks',
    icon: <Music className="w-6 h-6 text-white" />,
    gradient: 'from-[#ff0050] to-[#00f2ea]',
  },
  {
    name: 'Instagram',
    desc: 'Reels, posts, stories, and IGTV in full quality',
    icon: <Image className="w-6 h-6 text-white" />,
    gradient: 'from-purple-600 via-pink-500 to-orange-400',
  },
  {
    name: 'Snapchat',
    desc: 'Stories, spotlights, and shared snaps',
    icon: <Camera className="w-6 h-6 text-white" />,
    gradient: 'from-yellow-400 to-yellow-500',
  },
  {
    name: 'YouTube',
    desc: 'Videos and shorts in up to 4K quality',
    icon: <Play className="w-6 h-6 text-white" />,
    gradient: 'from-red-600 to-red-500',
  },
]

const features = [
  {
    icon: <Monitor className="w-5 h-5" />,
    title: 'HD & 4K Quality',
    desc: 'Download in the highest quality available — up to 4K Ultra HD',
    color: 'text-orange-500',
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Content Preview',
    desc: "See what you're downloading before you save it to your device",
    color: 'text-amber-500',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Lightning Fast',
    desc: 'Content is processed instantly so you can save media in seconds',
    color: 'text-yellow-500',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Safe & Private',
    desc: 'No data is stored and no account needed. Completely anonymous',
    color: 'text-emerald-500',
  },
  {
    icon: <Headphones className="w-5 h-5" />,
    title: 'Audio Extract',
    desc: 'Extract audio from any video as high-quality MP3 files',
    color: 'text-pink-500',
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: '7+ Platforms',
    desc: 'TikTok, Instagram, YouTube, Snapchat, Twitter, Facebook & more',
    color: 'text-blue-500',
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
            Free HD Video & Image Downloader
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-5 leading-tight tracking-tight"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Download Videos in
            <br />
            <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              HD Quality
            </span>
          </h1>

          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
            Paste any link from TikTok, Instagram, YouTube, or Snapchat.
            Preview the content, choose quality, and download instantly.
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
                {p.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                {p.name}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">{p.desc}</p>
            </Link>
          ))}
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
            {[
              {
                step: '1',
                title: 'Paste the Link',
                desc: 'Copy the share link from any supported platform and paste it into the downloader',
              },
              {
                step: '2',
                title: 'Preview & Select Quality',
                desc: 'See a preview of the content and choose your preferred quality — from 360p to 4K',
              },
              {
                step: '3',
                title: 'Download',
                desc: 'Hit download and save the content directly to your device in seconds',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200 text-orange-600 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
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
          Why SaveMedia?
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

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 sm:p-10 text-center shadow-xl shadow-orange-500/20">
          <h2
            className="text-xl sm:text-2xl font-bold text-white mb-3"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Ready to download?
          </h2>
          <p className="text-sm text-white/80 mb-6 max-w-md mx-auto">
            No registration, no limits. Just paste your link and get your content in HD.
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

      {/* Professional Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Main Footer */}
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
                {['TikTok', 'Instagram', 'YouTube', 'Snapchat', 'Twitter', 'Facebook'].map((p) => (
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
              &copy; {new Date().getFullYear()} SaveMedia. Download responsibly and respect content creators' rights.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
