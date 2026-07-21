import { ChoiceBar, PageHeader, Screen, Stack, Surface, Text, Toggle } from '../../ui';
import { SettingRow } from './row';

export type SettingsModel = {
  allowCellular: boolean; appVersion: string; notifications: boolean; quality: 'Balanced' | 'Original' | 'Audio';
  saveLocation: string; smartAutoSave: boolean; themeMode: 'system' | 'light' | 'dark'; notice?: string;
};
export const defaultSettings: SettingsModel = {
  allowCellular: true, appVersion: '1.0.0', notifications: true, quality: 'Balanced', saveLocation: 'Gallery', smartAutoSave: true, themeMode: 'system',
};
type Quality = 'balanced' | 'original' | 'audio';

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <Stack gap="sm"><Text color="textMuted" variant="label">{title}</Text><Surface style={{ paddingBottom: 0, paddingTop: 0 }}>{children}</Surface></Stack>;
}

export function SettingsScreen({ settings, onAllowCellularChange, onClearHistory, onClearTemporaryFiles, onContactPress, onHelpPress,
  onLegalPress, onNotificationsChange, onPrivacyPress, onQualityChange, onRatePress, onSaveLocationPress, onShareAppPress,
  onSmartAutoSaveChange, onThemeChange }: {
  settings: SettingsModel; onAllowCellularChange?: (value: boolean) => void; onClearHistory?: () => void; onClearTemporaryFiles?: () => void;
  onContactPress?: () => void; onHelpPress?: () => void; onLegalPress?: () => void; onNotificationsChange?: (value: boolean) => void;
  onPrivacyPress?: () => void; onQualityChange?: (value: Quality) => void; onRatePress?: () => void; onSaveLocationPress?: () => void;
  onShareAppPress?: () => void; onSmartAutoSaveChange?: (value: boolean) => void; onThemeChange?: (value: SettingsModel['themeMode']) => void;
}) {
  return <Screen scroll><Stack gap="xl"><PageHeader subtitle="Choose how iMediaSave works on this device" title="Settings" />
    {settings.notice ? <Text color="textMuted">{settings.notice}</Text> : null}
    <Section title="GENERAL">
      <SettingRow icon="palette" title="Theme" value={settings.themeMode === 'system' ? 'System' : settings.themeMode === 'light' ? 'Light' : 'Dark'}
        control={<ChoiceBar accessibilityLabel="Theme choices" choices={[
          { label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' },
        ]} onChange={(mode) => onThemeChange?.(mode)} value={settings.themeMode} />} />
      <SettingRow icon="globe" title="Language" value="English" />
    </Section>
    <Section title="DOWNLOADS">
      <SettingRow icon="download" title="Download quality" value={settings.quality}
        control={<ChoiceBar accessibilityLabel="Download quality choices" choices={[
          { label: 'Balanced', value: 'balanced' }, { label: 'Original', value: 'original' }, { label: 'Audio', value: 'audio' },
        ]} onChange={(quality) => onQualityChange?.(quality)} value={settings.quality.toLowerCase() as Quality} />} />
      <SettingRow accessibilityLabel="Manage save location access" icon="image" onPress={onSaveLocationPress} title="Save to" value={settings.saveLocation} />
      <SettingRow control={<Toggle label="Smart auto-save" onValueChange={onSmartAutoSaveChange} value={settings.smartAutoSave} />}
        description="Start links shared into iMediaSave automatically." icon="bolt" title="Auto download" />
      <SettingRow control={<Toggle label="Download over cellular" onValueChange={onAllowCellularChange} value={settings.allowCellular} />}
        icon="globe" title="Download over cellular" />
      <SettingRow control={<Toggle label="Completion notifications" onValueChange={onNotificationsChange} value={settings.notifications} />}
        icon="bell" title="Notifications" />
    </Section>
    <Section title="STORAGE">
      <SettingRow accessibilityLabel="Clear temporary files" icon="trash" onPress={onClearTemporaryFiles} title="Clear temporary files" />
      <SettingRow accessibilityLabel="Clear download history" icon="history" onPress={onClearHistory} title="Clear download history" />
    </Section>
    <Section title="SUPPORT">
      <SettingRow icon="info" onPress={onHelpPress} title="Help Center" value={onHelpPress ? undefined : 'Unavailable'} />
      <SettingRow icon="globe" onPress={onContactPress} title="Contact Us" value={onContactPress ? undefined : 'Unavailable'} />
      <SettingRow icon="sparkle" onPress={onRatePress} title="Rate iMediaSave" value={onRatePress ? undefined : 'Unavailable'} />
      <SettingRow icon="share" onPress={onShareAppPress} title="Share iMediaSave" />
    </Section>
    <Section title="PRIVACY & ABOUT">
      <SettingRow accessibilityLabel="Open Privacy Policy" icon="lock" onPress={onPrivacyPress} title="Privacy Policy" />
      <SettingRow accessibilityLabel="Open Disclaimer" icon="info" onPress={onLegalPress} title="Disclaimer" />
      <SettingRow icon="info" title="App version" value={settings.appVersion} />
    </Section>
  </Stack></Screen>;
}
