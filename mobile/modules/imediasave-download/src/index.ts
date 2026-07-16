import { requireOptionalNativeModule } from 'expo-modules-core';

import type { NativeDownloadsModule } from './types';

export * from './types';

export function getOptionalNativeDownloads(): NativeDownloadsModule | null {
  return requireOptionalNativeModule<NativeDownloadsModule>('IMediaSaveDownload');
}
