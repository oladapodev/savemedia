import {
  AndroidConfig,
  createRunOncePlugin,
  type ConfigPlugin,
  withAndroidManifest,
} from 'expo/config-plugins';

export const DOWNLOAD_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
] as const;

export const BLOCKED_MEDIA_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.ACCESS_MEDIA_LOCATION',
] as const;

const DISALLOWED_MEDIA_PERMISSIONS = new Set<string>(BLOCKED_MEDIA_PERMISSIONS);

const SYSTEM_FOREGROUND_SERVICE = 'androidx.work.impl.foreground.SystemForegroundService';
const SHARE_ACTIONS = new Set([
  'android.intent.action.SEND',
  'android.intent.action.SEND_MULTIPLE',
]);

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;
type IntentFilter = AndroidConfig.Manifest.ManifestIntentFilter;

function actionName(filter: IntentFilter): string | undefined {
  return filter.action?.[0]?.$['android:name'];
}

function shareFilter(action: string, mimeTypes: readonly string[]): IntentFilter {
  return {
    $: { 'android:autoVerify': 'false' },
    action: [{ $: { 'android:name': action } }],
    category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    data: mimeTypes.map((mimeType) => ({ $: { 'android:mimeType': mimeType } })),
  };
}

export function applyDownloadManifest(manifest: AndroidManifest): AndroidManifest {
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

  const existingPermissions = manifest.manifest['uses-permission'] ?? [];
  const unrelated = existingPermissions.filter(({ $ }) => (
    !DOWNLOAD_PERMISSIONS.includes($['android:name'] as (typeof DOWNLOAD_PERMISSIONS)[number])
    && !DISALLOWED_MEDIA_PERMISSIONS.has($['android:name'])
  ));
  manifest.manifest['uses-permission'] = [
    ...unrelated,
    ...DOWNLOAD_PERMISSIONS.map((permission) => ({ $: { 'android:name': permission } })),
    ...BLOCKED_MEDIA_PERMISSIONS.map((permission) => ({
      $: { 'android:name': permission, 'tools:node': 'remove' },
    })),
  ];

  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.service = [
    ...(application.service ?? []).filter(({ $ }) => $['android:name'] !== SYSTEM_FOREGROUND_SERVICE),
    {
      $: {
        'android:name': SYSTEM_FOREGROUND_SERVICE,
        'android:exported': 'false',
        'android:foregroundServiceType': 'dataSync',
        'tools:node': 'merge',
      },
    },
  ];

  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  mainActivity['intent-filter'] = [
    ...(mainActivity['intent-filter'] ?? []).filter((filter) => !SHARE_ACTIONS.has(actionName(filter) ?? '')),
    shareFilter('android.intent.action.SEND', ['text/plain', 'image/*', 'video/*']),
    shareFilter('android.intent.action.SEND_MULTIPLE', ['image/*', 'video/*']),
  ];
  return manifest;
}

const withDownloadModule: ConfigPlugin = (config) => {
  const permissions = (config.android?.permissions ?? []).filter((permission) => (
    !DISALLOWED_MEDIA_PERMISSIONS.has(permission)
    && !DOWNLOAD_PERMISSIONS.includes(permission as (typeof DOWNLOAD_PERMISSIONS)[number])
  ));
  config.android = {
    ...config.android,
    permissions: [...permissions, ...DOWNLOAD_PERMISSIONS],
    blockedPermissions: [...new Set([
      ...(config.android?.blockedPermissions ?? []),
      ...BLOCKED_MEDIA_PERMISSIONS,
    ])],
  };
  return withAndroidManifest(config, (next) => {
    next.modResults = applyDownloadManifest(next.modResults);
    return next;
  });
};

export default createRunOncePlugin(withDownloadModule, 'imediasave-download', '1.0.0');
