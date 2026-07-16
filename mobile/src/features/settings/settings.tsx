import {
  Button,
  PageHeader,
  Screen,
  Stack,
  Text,
  Toggle,
} from '../../ui';
import { SettingRow } from './row';

export type SettingsModel = {
  allowCellular: boolean;
  appVersion: string;
  notifications: boolean;
  quality: 'Balanced' | 'Original' | 'Audio';
  saveLocation: string;
  smartAutoSave: boolean;
  notice?: string;
};

export const defaultSettings: SettingsModel = {
  allowCellular: true,
  appVersion: '1.0.0',
  notifications: true,
  quality: 'Balanced',
  saveLocation: 'Photos & media library',
  smartAutoSave: true,
};

type SettingsScreenProps = {
  onAllowCellularChange?: (value: boolean) => void;
  onClearHistory?: () => void;
  onClearTemporaryFiles?: () => void;
  onLegalPress?: () => void;
  onNotificationsChange?: (value: boolean) => void;
  onPrivacyPress?: () => void;
  onQualityChange?: (value: 'balanced' | 'original' | 'audio') => void;
  onSaveLocationPress?: () => void;
  onSmartAutoSaveChange?: (value: boolean) => void;
  settings: SettingsModel;
};

const qualityOptions: Array<{
  description: string;
  label: SettingsModel['quality'];
  value: 'balanced' | 'original' | 'audio';
}> = [
  { description: 'Balanced default for most saves.', label: 'Balanced', value: 'balanced' },
  { description: 'Prefer the original upload quality.', label: 'Original', value: 'original' },
  { description: 'Extract audio only.', label: 'Audio', value: 'audio' },
];

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Stack gap="sm">
      <Text color="textMuted" variant="label">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

export function SettingsScreen({
  onAllowCellularChange,
  onClearHistory,
  onClearTemporaryFiles,
  onLegalPress,
  onNotificationsChange,
  onPrivacyPress,
  onQualityChange,
  onSaveLocationPress,
  onSmartAutoSaveChange,
  settings,
}: SettingsScreenProps) {
  return (
    <Screen scroll>
      <Stack gap="xl">
        <PageHeader
          subtitle="Choose how downloads are saved on this device."
          title="Settings"
        />

        {settings.notice ? <Text color="textMuted">{settings.notice}</Text> : null}

        <Section title="DOWNLOADS">
          <SettingRow
            control={(
              <Stack gap="xs">
                {qualityOptions.map((option) => (
                  <Button
                    accessibilityState={{ selected: settings.quality === option.label }}
                    key={option.value}
                    label={option.label}
                    onPress={() => onQualityChange?.(option.value)}
                    variant={settings.quality === option.label ? 'primary' : 'secondary'}
                  />
                ))}
              </Stack>
            )}
            description="Pick the default quality once instead of cycling through it."
            title="Default quality"
            value={settings.quality}
          />
          <SettingRow
            control={(
              <Toggle
                label="Smart auto-save"
                onValueChange={onSmartAutoSaveChange}
                value={settings.smartAutoSave}
              />
            )}
            description="Start clear, unambiguous shared links automatically."
            title="Smart auto-save"
          />
          <SettingRow
            control={(
              <Toggle
                label="Completion notifications"
                onValueChange={onNotificationsChange}
                value={settings.notifications}
              />
            )}
            description="Let me know when media is available on the device."
            title="Completion notifications"
          />
          <SettingRow
            control={(
              <Toggle
                label="Download over cellular"
                onValueChange={onAllowCellularChange}
                value={settings.allowCellular}
              />
            )}
            title="Download over cellular"
          />
        </Section>

        <Section title="STORAGE & HISTORY">
          <SettingRow
            title="Save location"
            value={settings.saveLocation}
            control={(
              <Button
                accessibilityLabel="Manage save location access"
                label="Manage"
                onPress={onSaveLocationPress}
                variant="secondary"
              />
            )}
          />
          <SettingRow
            description="Remove leftover working files without touching saved media."
            title="Temporary files"
            control={(
              <Button
                accessibilityLabel="Clear temporary files"
                label="Clear"
                onPress={onClearTemporaryFiles}
                variant="secondary"
              />
            )}
          />
          <SettingRow
            description="History is kept until you choose to remove it."
            title="Download history"
            control={(
              <Button
                accessibilityLabel="Clear download history"
                label="Clear"
                onPress={onClearHistory}
                variant="danger"
              />
            )}
          />
        </Section>

        <Section title="PRIVACY & ABOUT">
          <SettingRow
            accessibilityLabel="Open Privacy Policy"
            description="How the app handles links, files, device data, and permissions."
            onPress={onPrivacyPress}
            title="Privacy"
          />
          <SettingRow
            accessibilityLabel="Open Disclaimer"
            description="Responsible use, rights, platform terms, and service limits."
            onPress={onLegalPress}
            title="Legal"
          />
          <SettingRow
            description="Help is not available because no support contact is configured in this app."
            title="Help"
          />
          <SettingRow title="App version" value={settings.appVersion} />
        </Section>
      </Stack>
    </Screen>
  );
}
