import type { DownloadProgress } from './types';

export function downloadProgressPercent(progress: DownloadProgress | undefined): number | undefined {
  if (!progress?.totalBytes || progress.totalBytes <= 0) return undefined;
  return Math.round((Math.min(progress.bytesWritten, progress.totalBytes) * 100) / progress.totalBytes);
}
