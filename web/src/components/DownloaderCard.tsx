import { useState, useCallback, useRef } from 'react'
import {
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Link as LinkIcon,
  Clipboard,
  Play,
  Music2,
  ImageIcon,
  Film,
  X,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Eye,
  User,
  RefreshCw,
} from 'lucide-react'
import {
  detectPlatform,
  PLATFORM_COLORS,
  PLATFORM_NAMES,
  SUPPORTED_PLATFORM_COPY,
} from '@/lib/platforms'

type Quality = '2160' | '1080' | '720' | '480' | '360' | 'audio'
type Status = 'idle' | 'previewing' | 'preview' | 'fetching' | 'ready' | 'downloading' | 'success' | 'error'
type ErrorContext = 'preview' | 'download' | null

interface MediaItem {
  url: string
  thumb?: string
  type?: string
  filename?: string
}

interface PreviewData {
  platform: string
  title?: string
  author?: string
  authorUrl?: string
  thumbnail?: string
  html?: string
  type?: string
  providerName?: string
  description?: string
}

interface DownloadData {
  platform: string
  downloadUrl?: string
  filename?: string
  type?: string
  multiple?: boolean
  items?: MediaItem[]
  audio?: string
}

const QUALITY_OPTIONS: { value: Quality; label: string; tag?: string }[] = [
  { value: '2160', label: '4K', tag: 'Ultra HD' },
  { value: '1080', label: '1080p', tag: 'Full HD' },
  { value: '720', label: '720p', tag: 'HD' },
  { value: '480', label: '480p', tag: 'SD' },
  { value: '360', label: '360p', tag: 'Low' },
  { value: 'audio', label: 'Audio', tag: 'MP3' },
]

export default function DownloaderCard() {
  const [url, setUrl] = useState('')
  const [quality, setQuality] = useState<Quality>('1080')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [downloadData, setDownloadData] = useState<DownloadData | null>(null)
  const [showQuality, setShowQuality] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [errorContext, setErrorContext] = useState<ErrorContext>(null)
  const [retryCount, setRetryCount] = useState(0)
  const embedRef = useRef<HTMLDivElement>(null)

  const detectedPlatform = url.trim() ? detectPlatform(url.trim()) : null

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      setStatus('idle')
      setMessage('')
      setPreview(null)
      setDownloadData(null)
    } catch {
      // Clipboard access denied
    }
  }, [])

  // Step 1: Fetch preview (oEmbed)
  const handleFetchPreview = async () => {
    if (!url.trim()) {
      setStatus('error')
      setMessage('Please paste a URL first')
      return
    }

    if (!detectedPlatform) {
      setStatus('error')
      setMessage(`Unsupported URL. Try links from: ${SUPPORTED_PLATFORM_COPY}.`)
      return
    }

    setStatus('previewing')
    setMessage('')
    setPreview(null)
    setDownloadData(null)
    setErrorContext(null)

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorContext('preview')
        const rawError = data.error
        setMessage((typeof rawError === 'string' ? rawError : null) || 'Failed to fetch preview.')
        return
      }

      setPreview(data)
      setStatus('preview')
      setRetryCount(0)
    } catch {
      setStatus('error')
      setErrorContext('preview')
      setMessage('Network error. Please check your connection and try again.')
    }
  }

  // Step 2: Fetch download links
  const handleFetchDownload = async (isAutoRetry = false) => {
    if (!url.trim()) return

    setStatus('fetching')
    setMessage(isAutoRetry ? 'Retrying with different servers...' : '')
    setErrorContext(null)

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), quality }),
      })

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        setStatus('error')
        setErrorContext('download')
        setMessage('Server returned an invalid response. Please try again.')
        setRetryCount((c) => c + 1)
        return
      }

      if (!res.ok) {
        const rawError = data.error
        const rawHint = data.hint
        const errorMsg = (typeof rawError === 'string' ? rawError : null) || 'Failed to get download link.'
        const hint = (typeof rawHint === 'string' ? rawHint : null) || ''

        // Auto-retry once on non-content-specific fetch failures
        const isFetchFail = errorMsg.includes('Could not fetch content') || errorMsg.includes('unavailable') || errorMsg.includes('download servers')
        const isContentSpecific = errorMsg.includes('private') || errorMsg.includes('deleted') || errorMsg.includes('age-restricted') || errorMsg.includes('login')
        if (isFetchFail && !isContentSpecific && !isAutoRetry && retryCount === 0) {
          // Wait briefly then auto-retry — the next attempt may hit different instances
          await new Promise((r) => setTimeout(r, 1500))
          setRetryCount(1)
          return handleFetchDownload(true)
        }

        setStatus('error')
        setErrorContext('download')
        setMessage(hint ? `${errorMsg}\n${hint}` : errorMsg)
        setRetryCount((c) => c + 1)
        return
      }

      setDownloadData(data as unknown as DownloadData)
      setStatus('ready')
      setRetryCount(0)

      if (data.multiple && Array.isArray(data.items)) {
        setSelectedItems(new Set((data.items as MediaItem[]).map((_: MediaItem, i: number) => i)))
      }
    } catch {
      setStatus('error')
      setErrorContext('download')
      setMessage('Network error. Please check your connection and try again.')
      setRetryCount((c) => c + 1)
    }
  }

  const triggerDownload = async (downloadUrl: string, filename: string): Promise<boolean> => {
    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`

    // Pre-validate the download URL with a HEAD request to catch errors before triggering download
    try {
      const check = await fetch(proxyUrl, { method: 'HEAD' })
      if (!check.ok) {
        return false
      }
      const ct = check.headers.get('content-type') || ''
      // If the proxy returned HTML, it's an error page, not media
      if (ct.includes('text/html')) {
        return false
      }
    } catch {
      // HEAD failed — still try the download, some servers don't support HEAD
    }

    const a = document.createElement('a')
    a.href = proxyUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)

    try {
      a.click()
    } catch {
      window.open(proxyUrl, '_blank')
    }

    setTimeout(() => {
      try { document.body.removeChild(a) } catch { /* already removed */ }
    }, 1000)
    return true
  }

  const handleCopyLink = async () => {
    const link = downloadData?.downloadUrl || (downloadData?.items?.[0]?.url)
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Direct link copied to clipboard! Paste it in your browser or a download manager.')
    } catch {
      // Fallback: select and copy from a temporary input
      const input = document.createElement('input')
      input.value = link
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setMessage('Direct link copied to clipboard!')
    }
  }

  const handleDownload = async () => {
    if (!downloadData) return

    setStatus('downloading')

    try {
      let allSucceeded = true

      if (downloadData.multiple && downloadData.items) {
        const items = downloadData.items.filter((_, i) => selectedItems.has(i))
        for (const item of items) {
          const ok = await triggerDownload(item.url, item.filename || 'media')
          if (!ok) allSucceeded = false
          await new Promise((r) => setTimeout(r, 800))
        }
      } else if (downloadData.downloadUrl) {
        allSucceeded = await triggerDownload(downloadData.downloadUrl, downloadData.filename || 'media')
      }

      if (!allSucceeded) {
        setStatus('error')
        setErrorContext('download')
        setMessage('The download link has expired or the media server denied access. Click "Get Download Link" again to get a fresh link.')
        setRetryCount((c) => c + 1)
        return
      }

      await new Promise((r) => setTimeout(r, 500))
      setStatus('success')
      setMessage('Download started! Check your browser\'s downloads. If the download didn\'t start, try disabling any popup blockers.')
    } catch {
      setStatus('error')
      setErrorContext('download')
      setMessage('Download failed. Try fetching a new download link, or try a lower quality setting.')
    }
  }

  const handleClear = () => {
    setUrl('')
    setStatus('idle')
    setMessage('')
    setPreview(null)
    setDownloadData(null)
    setSelectedItems(new Set())
    setErrorContext(null)
    setRetryCount(0)
  }

  const currentQuality = QUALITY_OPTIONS.find((q) => q.value === quality)

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Main Input Area */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg shadow-orange-500/5 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300">
        {/* URL Input Section */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>Paste any link</h2>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (status !== 'idle') {
                    setStatus('idle')
                    setMessage('')
                    setPreview(null)
                    setDownloadData(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFetchPreview()
                }}
                placeholder="https://www.tiktok.com/@user/video/..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
              />
              {url && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={handlePaste}
              className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-orange-600 hover:bg-orange-50 hover:border-orange-200 transition-all text-sm font-medium flex items-center gap-1.5 shrink-0"
            >
              <Clipboard className="w-4 h-4" />
              <span className="hidden sm:inline">Paste</span>
            </button>
          </div>

          {/* Platform Detection Badge */}
          {detectedPlatform && (
            <div className="mt-3 flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${PLATFORM_COLORS[detectedPlatform]} text-white`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                {PLATFORM_NAMES[detectedPlatform]} detected
              </div>
            </div>
          )}

          {/* Quality Selector */}
          <div className="mt-4">
            <button
              onClick={() => setShowQuality(!showQuality)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Film className="w-3.5 h-3.5" />
              Quality: <span className="text-gray-700 font-medium">{currentQuality?.label} {currentQuality?.tag && `(${currentQuality.tag})`}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuality ? 'rotate-180' : ''}`} />
            </button>

            {showQuality && (
              <div className="mt-3 flex flex-wrap gap-2">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setQuality(opt.value)
                      if (downloadData) {
                        setDownloadData(null)
                        setStatus(preview ? 'preview' : 'idle')
                      }
                    }}
                    className={`quality-badge ${quality === opt.value ? 'active' : ''}`}
                  >
                    {opt.label}
                    {opt.tag && <span className="ml-1 opacity-70">{opt.tag}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Button (Step 1) */}
        {(status === 'idle' || (status === 'error' && errorContext !== 'download')) && (
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <button
              onClick={handleFetchPreview}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] shadow-lg shadow-orange-500/25 transition-all"
            >
              <Eye className="w-4 h-4" />
              Preview Content
            </button>
          </div>
        )}

        {/* Loading: Fetching Preview */}
        {status === 'previewing' && (
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-orange-100 text-orange-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching preview...
            </div>
          </div>
        )}

        {/* Preview Section (Step 1 result) */}
        {(status === 'preview' || status === 'fetching' || status === 'ready' || status === 'downloading' || status === 'success' || (status === 'error' && errorContext === 'download')) && preview && (
          <div className="border-t border-gray-100">
            <div className="p-5 sm:p-6 space-y-4">
              {/* Rich Preview Card */}
              <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                {/* Thumbnail */}
                {preview.thumbnail && (
                  <div className="preview-container">
                    <img
                      src={preview.thumbnail}
                      alt={preview.title || 'Content preview'}
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <Play className="w-6 h-6 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}

                {/* No thumbnail fallback */}
                {!preview.thumbnail && (
                  <div className="w-full aspect-video bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <Film className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Preview not available for this content</p>
                    </div>
                  </div>
                )}

                {/* Content Info */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                        {preview.title || 'Untitled content'}
                      </h3>
                      {preview.author && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          {preview.authorUrl ? (
                            <a
                              href={preview.authorUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-orange-500 transition-colors"
                            >
                              {preview.author}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">{preview.author}</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r ${PLATFORM_COLORS[preview.platform]} text-white`}>
                          {PLATFORM_NAMES[preview.platform]}
                        </span>
                        <span className="text-xs text-gray-400">
                          {preview.type || 'video'}
                        </span>
                      </div>
                      {preview.description && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{preview.description}</p>
                      )}
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-2 rounded-lg bg-gray-100 hover:bg-orange-50 transition-colors"
                      title="Open original"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Embed Preview (if available) */}
              {preview.html && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                    <Eye className="w-3 h-3" />
                    Embedded preview
                  </p>
                  <div
                    ref={embedRef}
                    className="w-full overflow-hidden rounded-lg [&_iframe]:w-full [&_iframe]:rounded-lg [&_blockquote]:text-gray-600 [&_blockquote]:text-sm"
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                  />
                </div>
              )}

              {/* Get Download Link Button (Step 2) */}
              {status === 'preview' && (
                <button
                  onClick={() => handleFetchDownload(false)}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  Get Download Link ({currentQuality?.label})
                </button>
              )}

              {/* Fetching download link */}
              {status === 'fetching' && (
                <div className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-orange-100 text-orange-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {message || 'Getting download link...'}
                </div>
              )}

              {/* Download Ready Section */}
              {status === 'ready' && downloadData && (
                <div className="space-y-3">
                  {/* Single item download */}
                  {!downloadData.multiple && downloadData.downloadUrl && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                          {downloadData.type === 'audio' ? (
                            <Music2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Film className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {downloadData.filename || 'Media file'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {quality === 'audio' ? 'Audio' : `${quality}p`} • {downloadData.type || 'video'} • Ready to download
                          </p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* Multiple items (carousel) */}
                  {downloadData.multiple && downloadData.items && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          {downloadData.items.length} items found
                        </p>
                        <button
                          onClick={() => {
                            if (selectedItems.size === downloadData.items!.length) {
                              setSelectedItems(new Set())
                            } else {
                              setSelectedItems(new Set(downloadData.items!.map((_, i) => i)))
                            }
                          }}
                          className="text-xs text-orange-500 hover:underline"
                        >
                          {selectedItems.size === downloadData.items.length ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {downloadData.items.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const next = new Set(selectedItems)
                              if (next.has(i)) next.delete(i)
                              else next.add(i)
                              setSelectedItems(next)
                            }}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              selectedItems.has(i)
                                ? 'border-orange-500 ring-1 ring-orange-500/30'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {item.thumb ? (
                              <img src={item.thumb} alt="" className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                                {item.type === 'photo' ? (
                                  <ImageIcon className="w-6 h-6 text-gray-300" />
                                ) : (
                                  <Film className="w-6 h-6 text-gray-300" />
                                )}
                              </div>
                            )}
                            {selectedItems.has(i) && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                              <span className="text-[10px] text-white/80 font-medium">
                                {item.type === 'photo' ? 'Photo' : 'Video'} {i + 1}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Download button */}
                  <button
                    onClick={handleDownload}
                    className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Download{downloadData.multiple && selectedItems.size > 0 ? ` (${selectedItems.size} items)` : ''}
                  </button>
                </div>
              )}

              {/* Downloading state */}
              {status === 'downloading' && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  <span className="text-sm text-gray-600">Starting download...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div
              className={`flex items-start gap-2 p-3.5 rounded-xl text-sm ${
                status === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-600'
                  : status === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                    : 'bg-gray-50 text-gray-600'
              }`}
            >
              {status === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
              <span className="whitespace-pre-line">{message}</span>
            </div>
            {status === 'error' && preview && errorContext === 'download' && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleFetchDownload(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Get New Link{retryCount > 1 ? ` (${retryCount + 1})` : ''}
                </button>
                {(downloadData?.downloadUrl || (downloadData?.items && downloadData.items.length > 0)) && (
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    Copy Direct Link
                  </button>
                )}
              </div>
            )}
            {status === 'error' && preview && errorContext !== 'download' && (
              <button
                onClick={handleFetchPreview}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry preview
              </button>
            )}
            {status === 'error' && !preview && errorContext === 'preview' && (
              <button
                onClick={handleFetchPreview}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry preview
              </button>
            )}
            {status === 'error' && errorContext === 'download' && (
              <div className="mt-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Troubleshooting tips:</p>
                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                  <li>Make sure the content is publicly accessible (not private or deleted)</li>
                  <li>Paste the direct link to the video/post, not a profile or search URL</li>
                  <li>Try a different quality setting (lower quality often works better)</li>
                  <li>If on mobile, make sure your browser allows downloads</li>
                  <li>Some platforms temporarily limit downloads — try again in a few minutes</li>
                  <li>Age-restricted or region-locked content cannot be downloaded</li>
                </ul>
              </div>
            )}
            {status === 'success' && (
              <button
                onClick={handleClear}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-50 transition-all"
              >
                Download another
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
