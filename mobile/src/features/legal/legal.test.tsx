import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';

function TestApp({ children }: { children: React.ReactNode }) {
  return <AppThemeProvider mode="light">{children}</AppThemeProvider>;
}

test('privacy screen accurately explains current mobile data handling and user choices', async () => {
  let PrivacyScreen!: typeof import('./privacy')['PrivacyScreen'];
  expect(() => {
    PrivacyScreen = require('./privacy').PrivacyScreen;
  }).not.toThrow();

  await render(<TestApp><PrivacyScreen onBack={jest.fn()} /></TestApp>);

  expect(screen.getByRole('header', { name: 'Privacy Policy' })).toBeTruthy();
  expect(screen.getByText(/clipboard is read only after you tap/i)).toBeTruthy();
  expect(screen.getByText(/shared URLs and files/i)).toBeTruthy();
  expect(screen.getByText(/public iMediaSave wrapper API/i)).toBeTruthy();
  expect(screen.getByText(/temporary working files/i)).toBeTruthy();
  expect(screen.getByText(/SQLite database on this device/i)).toBeTruthy();
  expect(screen.getByText(/active, failed, completed, and cancelled job records, including source URLs/i)).toBeTruthy();
  expect(screen.getByText(/Photos or media library/i)).toBeTruthy();
  expect(screen.getByText(/does not require an account/i)).toBeTruthy();
  expect(screen.getByText(/does not include advertising or analytics trackers/i)).toBeTruthy();
  expect(screen.getByText(/retention and deletion/i)).toBeTruthy();
  expect(screen.getByText(/removing a visible history entry also removes its completed app-local job record/i)).toBeTruthy();
  expect(screen.getByText(/hidden failed or cancelled job records may remain/i)).toBeTruthy();
  expect(screen.getByText(/clear the app's storage or uninstall the app/i)).toBeTruthy();
  expect(screen.getByText(/no contact channel is configured/i)).toBeTruthy();
  expect(screen.queryByText(/operator contact published/i)).toBeNull();
  expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeTruthy();
});

test('disclaimer states the required limits without promising universal support', async () => {
  let DisclaimerScreen!: typeof import('./disclaimer')['DisclaimerScreen'];
  expect(() => {
    DisclaimerScreen = require('./disclaimer').DisclaimerScreen;
  }).not.toThrow();

  await render(<TestApp><DisclaimerScreen onBack={jest.fn()} /></TestApp>);

  expect(screen.getByRole('header', { name: 'Disclaimer and Responsible Use' })).toBeTruthy();
  expect(screen.getByText(/only content you created, own, or have permission/i)).toBeTruthy();
  expect(screen.getByText(/copyright, privacy, publicity, or contractual rights/i)).toBeTruthy();
  expect(screen.getByText(/source platform's terms/i)).toBeTruthy();
  expect(screen.getByText(/not affiliated with, sponsored by, or endorsed by/i)).toBeTruthy();
  expect(screen.getByText(/not every platform, link, quality, format, or download will work/i)).toBeTruthy();
  expect(screen.getByText(/you are responsible/i)).toBeTruthy();
  expect(screen.getByText(/general product information, not legal advice/i)).toBeTruthy();
  expect(screen.queryByText(/all platforms/i)).toBeNull();
  expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeTruthy();
});
