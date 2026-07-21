import { useState } from 'react';
import { Linking, Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useDownloads } from '../../src/downloads/context';
import { SettingsScreen } from '../../src/features/settings/settings';

function siteUrl(path: '/help' | '/contact') {
  const base = process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/u, '');
  return base ? `${base}${path}` : undefined;
}

export default function SettingsRoute() {
  const downloads = useDownloads();
  const router = useRouter();
  const [externalNotice, setExternalNotice] = useState<string>();
  const run = (action: () => Promise<unknown> | void) => { try { void Promise.resolve(action()).catch(() => undefined); } catch {} };
  const openExternal = (url: string) => {
    setExternalNotice(undefined);
    void Linking.openURL(url).catch(() => setExternalNotice('That link could not be opened on this device.'));
  };
  const openSite = (path: '/help' | '/contact') => { const url = siteUrl(path); if (url) openExternal(url); };
  const helpUrl = siteUrl('/help');
  const contactUrl = siteUrl('/contact');
  const rateUrl = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_APP_STORE_URL : process.env.EXPO_PUBLIC_PLAY_STORE_URL;
  return <SettingsScreen settings={{ ...downloads.settings, ...(externalNotice ? { notice: externalNotice } : {}) }}
    onAllowCellularChange={(allowCellular) => run(() => downloads.updateSettings({ allowCellular }))}
    onClearHistory={() => run(() => downloads.deleteHistory(downloads.history.items.map(({ id }) => id), 'history-only'))}
    onClearTemporaryFiles={() => run(downloads.cleanupTemporary)}
    {...(contactUrl ? { onContactPress: () => openSite('/contact') } : {})} {...(helpUrl ? { onHelpPress: () => openSite('/help') } : {})}
    onLegalPress={() => router.push('/disclaimer')} onNotificationsChange={(alerts) => run(() => downloads.updateSettings({ alerts }))}
    onPrivacyPress={() => router.push('/privacy')} onQualityChange={(quality) => run(() => downloads.updateSettings({ quality }))}
    {...(rateUrl ? { onRatePress: () => openExternal(rateUrl) } : {})} onSaveLocationPress={() => run(downloads.requestSaveLocationAccess)}
    onShareAppPress={() => { setExternalNotice(undefined); void Share.share({ message: `${process.env.EXPO_PUBLIC_SITE_URL ?? 'iMediaSave'} — save supported public media links.` })
      .catch(() => setExternalNotice('The share sheet could not be opened on this device.')); }}
    onSmartAutoSaveChange={(smartAutoSave) => run(() => downloads.updateSettings({ smartAutoSave }))}
    onThemeChange={(themeMode) => run(() => downloads.updateSettings({ themeMode }))} />;
}
