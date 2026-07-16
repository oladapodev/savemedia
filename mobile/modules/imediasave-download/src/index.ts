import { requireOptionalNativeModule } from 'expo';

import type { NativeDownloadsModule } from './types';

export * from './types';

export function getOptionalNativeDownloads(): NativeDownloadsModule | null {
  return requireOptionalNativeModule<NativeDownloadsModule>('IMediaSaveDownload');
}
