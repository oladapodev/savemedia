import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Download, Home, ArrowDownToLine, BookOpenText } from 'lucide-react'

import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SaveMedia — HD Video & Image Downloader',
      },
      {
        name: 'description',
        content: 'Download HD videos and images from TikTok, Instagram, Snapchat and more. Preview content before downloading with quality selection.',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon.png',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-orange-100/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Download className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Save<span className="text-orange-500">Media</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-all [&.active]:text-orange-600 [&.active]:bg-orange-50"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Link
              to="/downloader"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-all [&.active]:text-orange-600 [&.active]:bg-orange-50"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span className="hidden sm:inline">Downloader</span>
            </Link>
            <Link
              to="/docs/api"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-all [&.active]:text-orange-600 [&.active]:bg-orange-50"
            >
              <BookOpenText className="w-4 h-4" />
              <span className="hidden sm:inline">API Docs</span>
            </Link>
          </div>
        </div>
      </nav>
      <div className="pt-16">
        <Outlet />
      </div>
    </>
  )
}
