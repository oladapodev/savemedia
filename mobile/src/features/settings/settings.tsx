import { ChoiceBar, Icon, Inline, PageHeader, Screen, Stack, Surface, Text, Toggle, type IconName } from '../../ui';
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

function Preference({ children, icon, testID, title, value }: { children: React.ReactNode; icon: IconName; testID: string; title: string; value: string }) {
  return <Stack gap="sm" testID={testID} style={{ paddingBottom: 14, paddingTop: 12 }}>
    <Inline gap="md"><Icon color="textMuted" name={icon} size={20} /><Text style={{ flex: 1 }} variant="label">{title}</Text><Text color="textMuted" variant="caption">{value}</Text></Inline>
    {children}
  </Stack>;
}

export function SettingsScreen({ settings, onAllowCellularChange, onClearHistory, onClearTemporaryFiles, onContactPress, onHelpPress,
  onLegalPress, onNotificationsChange, onPrivacyPress, onQualityChange, onRatePress, onSaveLocationPress, onShareAppPress,
  onSmartAutoSaveChange, onThemeChange }: {
  settings: SettingsModel; onAllowCellularChange?: (value: boolean) => void; onClearHistory?: () => void; onClearTemporaryFiles?: () => void;
  onContactPress?: () => void; onHelpPress?: () => void; onLegalPress?: () => void; onNotificationsChange?: (value: boolean) => void;
  onPrivacyPress?: () => void; onQualityChange?: (value: Quality) => void; onRatePress?: () => void; onSaveLocationPress?: () => void;
  onShareAppPress?: () => void; onSmartAutoSaveChange?: (value: boolean) => void; onThemeChange?: (value: SettingsModel['themeMode']) => void;
}) {
  return <Screen edges={['top', 'left', 'right']} scroll><Stack gap="xl"><PageHeader subtitle="Choose how iMediaSave works on this device" title="Settings" />
    {settings.notice ? <Text color="textMuted">{settings.notice}</Text> : null}
    <Section title="GENERAL">
      <Preference icon="palette" testID="theme-preference" title="Theme" value={settings.themeMode === 'system' ? 'System' : settings.themeMode === 'light' ? 'Light' : 'Dark'}>
        <ChoiceBar accessibilityLabel="Theme choices" choices={[
          { label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' },
        ]} onChange={(mode) => onThemeChange?.(mode)} value={settings.themeMode} />
      </Preference>
      <SettingRow icon="globe" title="Language" value="English" />
    </Section>
    <Section title="DOWNLOADS">
      <Preference icon="download" testID="quality-preference" title="Download quality" value={settings.quality}>
        <ChoiceBar accessibilityLabel="Download quality choices" choices={[
          { label: 'Balanced', value: 'balanced' }, { label: 'Original', value: 'original' }, { label: 'Audio', value: 'audio' },
        ]} onChange={(quality) => onQualityChange?.(quality)} value={settings.quality.toLowerCase() as Quality} />
      </Preference>
      <SettingRow accessibilityLabel="Manage save location access" icon="image" onPress={onSaveLocationPress} title="Save to" value={settings.saveLocation} />
      <SettingRow control={<Toggle label="Smart auto-save" onValueChange={onSmartAutoSaveChange} value={settings.smartAutoSave} />}
        description="Start links shared into iMediaSave automatically." icon="bolt" title="Auto download" />
      <SettingRow control={<Toggle label="Download over cellular" onValueChange={onAllowCellularChange} value={settings.allowCellular} />}
        icon="globe" title="Download over cellular" />
      <SettingRow control={<Toggle label="Completion notifications" onValueChange={onNotificationsChange} value={settings.notifications} />}
        icon="bell" title="Notifications" />
    </Section>
    {onClearTemporaryFiles || onClearHistory ? <Section title="STORAGE">
      {onClearTemporaryFiles ? <SettingRow accessibilityLabel="Clear temporary files" icon="trash" onPress={onClearTemporaryFiles} title="Clear temporary files" /> : null}
      {onClearHistory ? <SettingRow accessibilityLabel="Clear download history" icon="history" onPress={onClearHistory} title="Clear download history" /> : null}
    </Section> : null}
    {onHelpPress || onContactPress || onRatePress || onShareAppPress ? <Section title="SUPPORT">
      {onHelpPress ? <SettingRow icon="info" onPress={onHelpPress} title="Help Center" /> : null}
      {onContactPress ? <SettingRow icon="globe" onPress={onContactPress} title="Contact Us" /> : null}
      {onRatePress ? <SettingRow icon="sparkle" onPress={onRatePress} title="Rate iMediaSave" /> : null}
      {onShareAppPress ? <SettingRow icon="share" onPress={onShareAppPress} title="Share iMediaSave" /> : null}
    </Section> : null}
    <Section title="PRIVACY & ABOUT">
      {onPrivacyPress ? <SettingRow accessibilityLabel="Open Privacy Policy" icon="lock" onPress={onPrivacyPress} title="Privacy Policy" /> : null}
      {onLegalPress ? <SettingRow accessibilityLabel="Open Disclaimer" icon="info" onPress={onLegalPress} title="Disclaimer" /> : null}
      <SettingRow icon="info" title="App version" value={settings.appVersion} />
    </Section>
  </Stack></Screen>;
}
