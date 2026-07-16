import appJson from '../../app.json';
import { getConfig } from '@expo/config';

test('retains the Task 8 iOS extension while release Android uses the bounded local intake plugin', () => {
  const plugins = appJson.expo.plugins;
  expect(plugins).toEqual(expect.arrayContaining([
    'expo-router',
    'expo-sqlite',
    expect.arrayContaining(['expo-media-library']),
    expect.arrayContaining(['expo-notifications']),
  ]));

  const sharing = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-sharing');
  expect(sharing).toEqual([
    'expo-sharing',
    {
      ios: {
        enabled: true,
        extensionBundleIdentifier: 'com.imediasave.app.ShareExtension',
        appGroupId: 'group.com.imediasave.app',
        activationRule: {
          supportsText: true,
          supportsWebUrlWithMaxCount: 1,
          supportsImageWithMaxCount: 10,
          supportsMovieWithMaxCount: 10,
        },
      },
      android: {
        enabled: false,
      },
    },
  ]);

  const serialized = JSON.stringify(sharing);
  expect(serialized).not.toContain('audio/');
  expect(serialized).not.toContain('application/*');
  expect(serialized).not.toContain('supportsFileWithMaxCount');
  expect(serialized).not.toContain('supportsAttachmentsWithMaxCount');
  expect(plugins).toContain('./plugins/withDownloadModule.ts');
});

test('generated public config does not request broad media reads for app-created files', () => {
  const generated = getConfig('.', {
    isPublicConfig: true,
    skipSDKVersionRequirement: true,
  }).exp;

  expect(generated.android?.permissions).toEqual([
    'android.permission.INTERNET',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  ]);
  expect(generated.android?.permissions).not.toContain('android.permission.READ_MEDIA_IMAGES');
  expect(generated.android?.permissions).not.toContain('android.permission.READ_MEDIA_VIDEO');
  expect(generated.android?.permissions).not.toContain('android.permission.READ_MEDIA_AUDIO');
});
