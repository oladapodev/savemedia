import type { SupportedPlatform } from '@/lib/platforms'

type BrandIconProps = {
  platform: SupportedPlatform
  className?: string
  decorative?: boolean
  monochrome?: boolean
}

export default function BrandIcon({
  platform,
  className = 'h-5 w-5',
  decorative = false,
  monochrome = false,
}: BrandIconProps) {
  return (
    <img
      src={platform.iconPath}
      alt={decorative ? '' : `${platform.name} logo`}
      aria-hidden={decorative || undefined}
      className={`${className} object-contain ${monochrome ? 'brightness-0 invert' : ''}`}
      loading="lazy"
      decoding="async"
    />
  )
}
