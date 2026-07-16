import {
  createRunOncePlugin,
  type ConfigPlugin,
  withEntitlementsPlist,
  withFinalizedMod,
  IOSConfig,
} from '@expo/config-plugins';
import plist from '@expo/plist';

declare const require: (id: string) => any;
const fs = require('fs') as {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  copyFileSync(source: string, destination: string): void;
  writeFileSync(path: string, data: string): void;
};
const path = require('path') as {
  join(...parts: string[]): string;
};
const xcode = require('xcode') as {
  project(path: string): {
    parseSync(): void;
    writeSync(): string;
    [key: string]: any;
  };
};

export const APP_GROUP_ID = 'group.com.imediasave.app';
export const EXTENSION_TARGET_NAME = 'ShareExtension';
export const EXTENSION_BUNDLE_ID = 'com.imediasave.app.ShareExtension';
const LEGACY_EXPO_TARGET_NAME = 'expo-sharing-extension';
const APP_GROUP_ENTITLEMENT = 'com.apple.security.application-groups';

type AppExtension = {
  targetName: string;
  bundleIdentifier: string;
  entitlements: Record<string, unknown>;
};

type MutableExpoConfig = {
  name: string;
  slug: string;
  version?: string;
  ios?: {
    bundleIdentifier?: string;
    buildNumber?: string;
    entitlements?: Record<string, unknown>;
    [key: string]: unknown;
  };
  extra?: {
    eas?: {
      build?: {
        experimental?: {
          ios?: { appExtensions?: AppExtension[] };
        };
      };
    };
  };
};

export function createExtensionEntitlements(): Record<string, string[]> {
  return { [APP_GROUP_ENTITLEMENT]: [APP_GROUP_ID] };
}

export function createExtensionInfoPlist(): Record<string, any> {
  return {
    CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
    CFBundleDisplayName: 'iMediaSave',
    CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    CFBundleInfoDictionaryVersion: '6.0',
    CFBundleName: '$(PRODUCT_NAME)',
    CFBundlePackageType: 'XPC!',
    CFBundleShortVersionString: '$(MARKETING_VERSION)',
    CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
    NSExtension: {
      NSExtensionAttributes: {
        NSExtensionActivationRule: {
          NSExtensionActivationSupportsText: true,
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsImageWithMaxCount: 10,
          NSExtensionActivationSupportsMovieWithMaxCount: 10,
        },
      },
      NSExtensionPointIdentifier: 'com.apple.share-services',
      NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).ShareViewController',
    },
  };
}

export function applyShareExtensionConfig<T extends MutableExpoConfig>(config: T): T {
  const appGroups = config.ios?.entitlements?.[APP_GROUP_ENTITLEMENT];
  const existingGroups = Array.isArray(appGroups) ? appGroups.filter((value): value is string => typeof value === 'string') : [];
  config.ios = {
    ...config.ios,
    entitlements: {
      ...config.ios?.entitlements,
      [APP_GROUP_ENTITLEMENT]: [...new Set([...existingGroups, APP_GROUP_ID])],
    },
  };

  const existing = config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? [];
  const extension: AppExtension = {
    targetName: EXTENSION_TARGET_NAME,
    bundleIdentifier: EXTENSION_BUNDLE_ID,
    entitlements: createExtensionEntitlements(),
  };
  const appExtensions = [
    ...existing.filter((item: AppExtension) => (
      item.targetName !== EXTENSION_TARGET_NAME
      && item.targetName !== LEGACY_EXPO_TARGET_NAME
      && item.bundleIdentifier !== EXTENSION_BUNDLE_ID
    )),
    extension,
  ];
  config.extra = {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions,
          },
        },
      },
    },
  };
  return config;
}

function unquote(value: unknown): string {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : '';
}

function findTarget(project: any, names: string[]): [string, any] | undefined {
  return Object.entries(project.pbxNativeTargetSection()).find(([key, target]) => (
    !key.endsWith('_comment') && names.includes(unquote((target as any).name))
  )) as [string, any] | undefined;
}

function extensionFolder(platformProjectRoot: string): string {
  return fs.existsSync(path.join(platformProjectRoot, LEGACY_EXPO_TARGET_NAME))
    ? LEGACY_EXPO_TARGET_NAME
    : EXTENSION_TARGET_NAME;
}

function writeExtensionFiles(projectRoot: string, platformProjectRoot: string): string {
  const folder = extensionFolder(platformProjectRoot);
  const destination = path.join(platformProjectRoot, folder);
  const source = path.join(projectRoot, 'extensions', 'share', 'ShareViewController.swift');
  fs.mkdirSync(destination, { recursive: true });

  const sourceFilename = folder === LEGACY_EXPO_TARGET_NAME
    ? 'ShareIntoViewController.swift'
    : 'ShareViewController.swift';
  fs.copyFileSync(source, path.join(destination, sourceFilename));
  fs.copyFileSync(
    path.join(projectRoot, 'extensions', 'share', 'Info.plist'),
    path.join(destination, 'Info.plist'),
  );
  fs.writeFileSync(
    path.join(destination, `${folder}.entitlements`),
    plist.build(createExtensionEntitlements()),
  );
  return folder;
}

function configureTarget(project: any, folder: string, config: MutableExpoConfig): void {
  let existing = findTarget(project, [EXTENSION_TARGET_NAME, LEGACY_EXPO_TARGET_NAME]);
  if (!existing) {
    const target = project.addTarget(
      EXTENSION_TARGET_NAME,
      'app_extension',
      folder,
      EXTENSION_BUNDLE_ID,
    );
    project.addPbxGroup(
      ['ShareViewController.swift', 'Info.plist', `${folder}.entitlements`],
      EXTENSION_TARGET_NAME,
      folder,
    );
    project.addBuildPhase(
      [`${folder}/ShareViewController.swift`],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
      'app_extension',
      '""',
    );
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    existing = [target.uuid, target.pbxNativeTarget];
  }

  const [targetId, target] = existing;
  target.name = `"${EXTENSION_TARGET_NAME}"`;
  target.productName = `"${EXTENSION_TARGET_NAME}"`;
  project.pbxNativeTargetSection()[`${targetId}_comment`] = EXTENSION_TARGET_NAME;
  const projectTargets = project.getFirstProject().firstProject.targets as Array<{ value: string; comment?: string }>;
  const projectTarget = projectTargets.find(({ value }) => value === targetId);
  if (projectTarget) projectTarget.comment = EXTENSION_TARGET_NAME;

  const product = project.pbxFileReferenceSection()[target.productReference];
  if (product) {
    product.name = `"${EXTENSION_TARGET_NAME}.appex"`;
    product.path = `"${EXTENSION_TARGET_NAME}.appex"`;
  }

  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const reference of list?.buildConfigurations ?? []) {
    const settings = configurations[reference.value]?.buildSettings;
    if (!settings) continue;
    settings.CODE_SIGN_ENTITLEMENTS = `"${folder}/${folder}.entitlements"`;
    settings.CURRENT_PROJECT_VERSION = `"${config.ios?.buildNumber ?? '1'}"`;
    settings.GENERATE_INFOPLIST_FILE = 'NO';
    settings.INFOPLIST_FILE = `"${folder}/Info.plist"`;
    settings.IPHONEOS_DEPLOYMENT_TARGET = '16.4';
    settings.MARKETING_VERSION = config.version ?? '1.0.0';
    settings.PRODUCT_BUNDLE_IDENTIFIER = `"${EXTENSION_BUNDLE_ID}"`;
    settings.PRODUCT_NAME = `"${EXTENSION_TARGET_NAME}"`;
    settings.SKIP_INSTALL = 'YES';
    settings.SWIFT_VERSION = '5.0';
    settings.TARGETED_DEVICE_FAMILY = '"1,2"';
  }
}

const withShareExtension: ConfigPlugin = (input) => {
  applyShareExtensionConfig(input as unknown as MutableExpoConfig);
  let config = input;
  let folder = EXTENSION_TARGET_NAME;

  config = withEntitlementsPlist(config, (next) => {
    const current = next.modResults[APP_GROUP_ENTITLEMENT];
    const groups = Array.isArray(current) ? current.filter((value): value is string => typeof value === 'string') : [];
    next.modResults[APP_GROUP_ENTITLEMENT] = [...new Set([...groups, APP_GROUP_ID])];
    return next;
  });
  config = withFinalizedMod(config, ['ios', async (next) => {
    folder = writeExtensionFiles(next.modRequest.projectRoot, next.modRequest.platformProjectRoot);
    const projectPath = IOSConfig.Paths.getPBXProjectPath(next.modRequest.projectRoot);
    const project = xcode.project(projectPath);
    project.parseSync();
    configureTarget(project, folder, next as unknown as MutableExpoConfig);
    fs.writeFileSync(projectPath, project.writeSync());
    return next;
  }]);
  return config;
};

export default createRunOncePlugin(withShareExtension, 'imediasave-share-extension', '1.0.0');
