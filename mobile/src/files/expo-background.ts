import { File } from 'expo-file-system';

import { createActiveRuntimeDownloads } from './background';

export const expoActiveRuntimeDownloads = createActiveRuntimeDownloads({
  async download(input) {
    const destination = new File(input.temporaryUri);
    const file = await File.downloadFileAsync(input.url, destination, {
      idempotent: true,
      signal: input.signal,
    });
    return { fileUri: file.uri, sizeBytes: file.size };
  },
});
