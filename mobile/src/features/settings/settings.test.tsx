import { render, screen, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';
import { defaultSettings, SettingsScreen } from './settings';

function TestApp({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider mode="light">{children}</AppThemeProvider>
  );
}

test('settings exposes balanced quality and smart defaults', async () => {
  await render(
    <TestApp>
      <SettingsScreen settings={defaultSettings} />
    </TestApp>,
  );

  expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
  expect(screen.getByText('Default quality')).toBeTruthy();
  expect(screen.getByRole('switch', { name: 'Smart auto-save' })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Smart auto-save' })).toBeChecked();
  expect(screen.getByRole('switch', { name: 'Completion notifications' })).toBeChecked();
});

test('settings exposes explicit quality choices instead of a single cycle button', async () => {
  await render(
    <TestApp>
      <SettingsScreen settings={defaultSettings} />
    </TestApp>,
  );

  expect(screen.getByRole('button', { name: 'Balanced' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Original' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Audio' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
});

test('settings exposes storage controls, legal navigation, and truthful noninteractive help', async () => {
  const onLegalPress = jest.fn();
  const onPrivacyPress = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestApp>
      <SettingsScreen
        onLegalPress={onLegalPress}
        onPrivacyPress={onPrivacyPress}
        settings={defaultSettings}
      />
    </TestApp>,
  );

  expect(screen.getByText('Photos & media library')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clear temporary files' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clear download history' })).toBeTruthy();
  await user.press(screen.getByRole('link', { name: 'Open Privacy Policy' }));
  await user.press(screen.getByRole('link', { name: 'Open Disclaimer' }));

  expect(onPrivacyPress).toHaveBeenCalledTimes(1);
  expect(onLegalPress).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/no support contact is configured in this app/i)).toBeTruthy();
  expect(screen.queryByText(/contact published by the operator/i)).toBeNull();
  expect(screen.queryByRole('link', { name: /help/i })).toBeNull();
});
