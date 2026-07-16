import type { MediaVariant } from './types';

/**
 * Picks the automatic video option without treating file size or the largest
 * available resolution as a proxy for a useful default.
 */
export function selectBalanced(
  variants: readonly MediaVariant[],
): MediaVariant | undefined {
  const reliableVideo = variants.filter(
    (variant) => variant.mediaType === 'video' && variant.reliable,
  );

  for (const targetHeight of [1080, 720]) {
    const preferred = reliableVideo.find(
      (variant) => variant.height === targetHeight,
    );
    if (preferred) return preferred;
  }

  return reliableVideo
    .filter((variant) => typeof variant.height === 'number' && variant.height < 720)
    .reduce<MediaVariant | undefined>(
      (best, variant) =>
        best === undefined || variant.height! > best.height! ? variant : best,
      undefined,
    );
}
