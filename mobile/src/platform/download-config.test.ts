import type { AndroidConfig } from '@expo/config-plugins';

import {
  BLOCKED_MEDIA_PERMISSIONS,
  DOWNLOAD_PERMISSIONS,
  applyDownloadManifest,
} from '../../plugins/withDownloadModule';

function fixture(): AndroidConfig.Manifest.AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
      'uses-permission': [],
      application: [{
        $: { 'android:name': '.MainApplication' },
        activity: [{
          $: {
            'android:name': '.MainActivity',
            'android:exported': 'true',
          },
          'intent-filter': [{
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
          }],
        }],
      }],
    },
  };
}

test('applies permissions, WorkManager service, and bounded share filters idempotently', () => {
  const manifest = fixture();
  applyDownloadManifest(manifest);
  const once = JSON.stringify(manifest);
  applyDownloadManifest(manifest);

  expect(JSON.stringify(manifest)).toBe(once);
  expect(manifest.manifest['uses-permission']
    ?.filter((permission) => permission.$['tools:node'] !== 'remove')
    .map((permission) => permission.$['android:name']))
    .toEqual(DOWNLOAD_PERMISSIONS);
  expect(manifest.manifest['uses-permission']
    ?.filter((permission) => permission.$['tools:node'] === 'remove')
    .map((permission) => permission.$['android:name']))
    .toEqual(BLOCKED_MEDIA_PERMISSIONS);

  const application = manifest.manifest.application?.[0];
  expect(application?.service).toContainEqual({
    $: expect.objectContaining({
      'android:name': 'androidx.work.impl.foreground.SystemForegroundService',
      'android:exported': 'false',
      'android:foregroundServiceType': 'dataSync',
      'tools:node': 'merge',
    }),
  });
  const shareFilters = application?.activity?.[0]['intent-filter']?.filter((filter) => (
    filter.action?.[0]?.$['android:name']?.startsWith('android.intent.action.SEND')
  ));
  expect(shareFilters).toHaveLength(2);
  expect(shareFilters?.flatMap((filter) => filter.data ?? []).map((entry) => entry.$['android:mimeType']))
    .toEqual(['text/plain', 'image/*', 'video/*', 'image/*', 'video/*']);

  expect(once).toContain('READ_MEDIA');
  expect(once).toContain('READ_EXTERNAL_STORAGE');
  expect(once).toContain('tools:node');
  expect(once).not.toContain('audio/');
  expect(once).not.toContain('application/*');
});
