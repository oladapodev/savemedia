import { render, screen, userEvent } from '@testing-library/react-native';
import { AppThemeProvider } from '../../ui';
import { defaultSettings, SettingsScreen } from './settings';

function TestApp({ children }: { children: React.ReactNode }) { return <AppThemeProvider mode="light">{children}</AppThemeProvider>; }

test('settings exposes the complete reference structure', async () => {
  await render(<TestApp><SettingsScreen settings={defaultSettings} /></TestApp>);
  expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
  expect(screen.getByText('Theme')).toBeTruthy();
  expect(screen.getByText('Language')).toBeTruthy();
  expect(screen.getByText('Download quality')).toBeTruthy();
  expect(screen.getByText('Help Center')).toBeTruthy();
  expect(screen.getByText('Contact Us')).toBeTruthy();
  expect(screen.getByText('Rate iMediaSave')).toBeTruthy();
  expect(screen.getByText('Share iMediaSave')).toBeTruthy();
  expect(screen.getByLabelText('Theme choices')).toBeTruthy();
  expect(screen.getByLabelText('Download quality choices')).toBeTruthy();
});

test('settings dispatches explicit theme and quality choices', async () => {
  const onThemeChange = jest.fn();
  const onQualityChange = jest.fn();
  const user = userEvent.setup();
  await render(<TestApp><SettingsScreen settings={defaultSettings} onThemeChange={onThemeChange} onQualityChange={onQualityChange} /></TestApp>);
  await user.press(screen.getByRole('button', { name: 'Dark' }));
  await user.press(screen.getByRole('button', { name: 'Original' }));
  expect(onThemeChange).toHaveBeenCalledWith('dark');
  expect(onQualityChange).toHaveBeenCalledWith('original');
});

test('settings exposes storage and legal actions', async () => {
  await render(<TestApp><SettingsScreen settings={defaultSettings} onSaveLocationPress={jest.fn()} onClearTemporaryFiles={jest.fn()}
    onClearHistory={jest.fn()} onPrivacyPress={jest.fn()} onLegalPress={jest.fn()} /></TestApp>);
  expect(screen.getByRole('link', { name: 'Manage save location access' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Clear temporary files' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Clear download history' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open Privacy Policy' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open Disclaimer' })).toBeTruthy();
});
