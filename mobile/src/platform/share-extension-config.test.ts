import appJson from '../../app.json';

import {
  APP_GROUP_ID,
  EXTENSION_BUNDLE_ID,
  EXTENSION_TARGET_NAME,
  applyShareExtensionConfig,
  createExtensionEntitlements,
  createExtensionInfoPlist,
} from '../../plugins/withShareExtension';

describe('iOS Share Extension config', () => {
  test('declares one production extension and the App Group idempotently', () => {
    const config = {
      name: 'iMediaSave',
      slug: 'imediasave',
      ios: { bundleIdentifier: 'com.imediasave.app' },
      extra: {
        eas: {
          build: {
            experimental: {
              ios: {
                appExtensions: [{
                  targetName: 'expo-sharing-extension',
                  bundleIdentifier: EXTENSION_BUNDLE_ID,
                  entitlements: {},
                }],
              },
            },
          },
        },
      },
    };

    applyShareExtensionConfig(config);
    const once = JSON.stringify(config);
    applyShareExtensionConfig(config);

    expect(JSON.stringify(config)).toBe(once);
    expect((config.ios as typeof config.ios & { entitlements?: Record<string, unknown> }).entitlements).toEqual({
      'com.apple.security.application-groups': [APP_GROUP_ID],
    });
    expect(config.extra.eas.build.experimental.ios.appExtensions).toEqual([{
      targetName: EXTENSION_TARGET_NAME,
      bundleIdentifier: EXTENSION_BUNDLE_ID,
      entitlements: createExtensionEntitlements(),
    }]);
  });

  test('uses a bounded URL, text, image, and movie activation rule without app launch keys', () => {
    const plist = createExtensionInfoPlist();
    const serialized = JSON.stringify(plist);

    expect(plist.NSExtension.NSExtensionPrincipalClass)
      .toBe('$(PRODUCT_MODULE_NAME).ShareViewController');
    expect(plist.NSExtension.NSExtensionAttributes.NSExtensionActivationRule).toEqual({
      NSExtensionActivationSupportsText: true,
      NSExtensionActivationSupportsWebURLWithMaxCount: 1,
      NSExtensionActivationSupportsImageWithMaxCount: 10,
      NSExtensionActivationSupportsMovieWithMaxCount: 10,
    });
    expect(serialized).not.toContain('MainTargetUrlScheme');
    expect(serialized).not.toContain('CFBundleURLSchemes');
  });

  test('keeps expo-sharing and Android plugins while registering the iOS production plugin', () => {
    const plugins = appJson.expo.plugins;
    const sharing = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-sharing');

    expect(sharing?.[1]).toEqual(expect.objectContaining({
      android: { enabled: false },
      ios: expect.objectContaining({ appGroupId: APP_GROUP_ID }),
    }));
    expect(plugins).toContain('./plugins/withDownloadModule.ts');
    expect(plugins).toContain('./plugins/withShareExtension.ts');
  });

  test('registers the linked EAS project', () => {
    expect(appJson.expo.extra.eas.projectId).toBe('6203a860-556a-4acc-99a9-0ec6535a10f5');
  });
});
