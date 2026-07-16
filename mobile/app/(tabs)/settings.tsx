import { useRouter } from 'expo-router';

import { useDownloads } from '../../src/downloads/context';
import { SettingsScreen } from '../../src/features/settings/settings';

export default function SettingsRoute() {
  const downloads = useDownloads();
  const router = useRouter();
  const nextQuality = downloads.settings.quality === 'Balanced'
    ? 'original'
    : downloads.settings.quality === 'Original' ? 'audio' : 'balanced';
  return (
    <SettingsScreen
      onAllowCellularChange={async (allowCellular) => { await downloads.updateSettings({ allowCellular }); }}
      onClearHistory={async () => { await downloads.deleteHistory(downloads.history.items.map(({ id }) => id), 'history-only'); }}
      onClearTemporaryFiles={downloads.cleanupTemporary}
      onLegalPress={() => router.push('/disclaimer')}
      onNotificationsChange={async (alerts) => { await downloads.updateSettings({ alerts }); }}
      onPrivacyPress={() => router.push('/privacy')}
      onQualityPress={async () => { await downloads.updateSettings({ quality: nextQuality }); }}
      onSaveLocationPress={downloads.requestSaveLocationAccess}
      onSmartAutoSaveChange={async (smartAutoSave) => { await downloads.updateSettings({ smartAutoSave }); }}
      settings={downloads.settings}
    />
  );
}
