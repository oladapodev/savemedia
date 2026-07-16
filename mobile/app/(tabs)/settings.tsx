import { useRouter } from 'expo-router';

import { useDownloads } from '../../src/downloads/context';
import { SettingsScreen } from '../../src/features/settings/settings';

export default function SettingsRoute() {
  const downloads = useDownloads();
  const router = useRouter();
  const runAction = (action: () => Promise<unknown> | void) => {
    try {
      void Promise.resolve(action()).catch(() => undefined);
    } catch {}
  };
  return (
    <SettingsScreen
      onAllowCellularChange={(allowCellular) => { runAction(() => downloads.updateSettings({ allowCellular })); }}
      onClearHistory={() => { runAction(() => downloads.deleteHistory(downloads.history.items.map(({ id }) => id), 'history-only')); }}
      onClearTemporaryFiles={() => { runAction(downloads.cleanupTemporary); }}
      onLegalPress={() => router.push('/disclaimer')}
      onNotificationsChange={(alerts) => { runAction(() => downloads.updateSettings({ alerts })); }}
      onPrivacyPress={() => router.push('/privacy')}
      onQualityChange={(quality) => { runAction(() => downloads.updateSettings({ quality })); }}
      onSaveLocationPress={() => { runAction(downloads.requestSaveLocationAccess); }}
      onSmartAutoSaveChange={(smartAutoSave) => { runAction(() => downloads.updateSettings({ smartAutoSave })); }}
      settings={downloads.settings}
    />
  );
}
