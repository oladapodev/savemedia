import { fireEvent, render, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../ui';
import type { HomeScreenModel } from '../features/home/home';

const mockInspectUrl = jest.fn().mockResolvedValue(true);
const mockStartSharedUrl = jest.fn().mockResolvedValue(undefined);
const mockDeleteHistory = jest.fn().mockResolvedValue({ deletedIds: ['one'], failures: [] });
const mockUpdateSettings = jest.fn().mockResolvedValue(undefined);
const mockCleanupTemporary = jest.fn().mockResolvedValue(undefined);
const mockRequestSaveLocationAccess = jest.fn().mockResolvedValue(undefined);
const mockPasteAndDownload = jest.fn().mockResolvedValue(undefined);
const mockPush = jest.fn();
const readyHome: HomeScreenModel = {
  cardDetail: 'Copy a public link.', cardTitle: 'Save media from a link', phase: 'ready',
  primaryAction: { label: 'Paste & download' }, statusDetail: 'Clipboard on tap.', statusText: 'Ready',
};
let mockHome = readyHome;
let capturedHomeProps: {
  onPrimaryAction?: () => void;
  onSubmitUrl?: (url: string) => Promise<void> | void;
} | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../src/features/home/home', () => ({
  HomeScreen: (props: unknown) => {
    capturedHomeProps = props as typeof capturedHomeProps;
    const { Text: MockText } = require('react-native') as typeof import('react-native');
    return <MockText>home</MockText>;
  },
}));

jest.mock('./context', () => ({
  useDownloads: () => ({
    home: mockHome,
    history: {
      items: [{
        id: 'one', title: 'one.mp4', sourceLabel: 'Instagram', detail: 'Video', dateLabel: 'Today',
        status: 'Saved', assetUri: 'ph://one', sourceUrl: 'https://instagram.com/reel/one',
      }],
    },
    downloads: { items: [] },
    preview: null,
    settings: {
      allowCellular: true, appVersion: '1.0.0', notifications: true,
      quality: 'Balanced', saveLocation: 'Gallery', smartAutoSave: true, themeMode: 'system',
    },
    inspectUrl: mockInspectUrl,
    confirmPreview: jest.fn(), clearPreview: jest.fn(),
    pasteAndDownload: mockPasteAndDownload,
    chooseMedia: jest.fn(), cancel: jest.fn(), retry: jest.fn(), deleteHistory: mockDeleteHistory, updateSettings: mockUpdateSettings,
    downloadAgain: jest.fn(), cleanupTemporary: mockCleanupTemporary,
    requestSaveLocationAccess: mockRequestSaveLocationAccess,
    share: jest.fn(), open: jest.fn(), startSharedUrl: mockStartSharedUrl,
  }),
}));

const HomeRoute = require('../../app/(tabs)/index').default as React.ComponentType;
const HistoryRoute = require('../../app/(tabs)/history').default as React.ComponentType;
const SettingsRoute = require('../../app/(tabs)/settings').default as React.ComponentType;

async function renderRoute(Route: React.ComponentType) {
  return render(<AppThemeProvider mode="light"><Route /></AppThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());
beforeEach(() => {
  capturedHomeProps = null;
  mockHome = readyHome;
});

test('thin Home route inspects the typed URL and opens preview', async () => {
  const view = await renderRoute(HomeRoute);
  expect(view.getByText('home')).toBeTruthy();
  await capturedHomeProps?.onSubmitUrl?.('https://example.com/shared');
  expect(mockInspectUrl).toHaveBeenCalledWith('https://example.com/shared');
  expect(mockPush).toHaveBeenCalledWith('/media/preview');
});

test('thin Home route stays home when preview fails', async () => {
  mockInspectUrl.mockResolvedValueOnce(false);
  const view = await renderRoute(HomeRoute);
  expect(view.getByText('home')).toBeTruthy();
  await capturedHomeProps?.onSubmitUrl?.('https://example.com/shared');
  expect(mockPush).not.toHaveBeenCalled();
});

test('thin Home route gives transient failures a working paste action', async () => {
  mockHome = {
    cardDetail: 'Try another public link.', cardTitle: 'Invalid link', phase: 'failed',
    primaryAction: { label: 'Paste another link' }, statusDetail: 'Clipboard on tap.', statusText: 'No link found',
  };
  const view = await renderRoute(HomeRoute);
  expect(view.getByText('home')).toBeTruthy();
  capturedHomeProps?.onPrimaryAction?.();
  expect(mockPasteAndDownload).toHaveBeenCalledTimes(1);
});

test('thin History route dispatches an explicit live deletion choice', async () => {
  const view = await renderRoute(HistoryRoute);
  const user = userEvent.setup();
  await user.press(view.getByRole('button', { name: 'Select downloads' }));
  await user.press(view.getByRole('button', { name: 'Select one.mp4' }));
  await user.press(view.getByRole('button', { name: 'Remove selected from history' }));
  expect(mockDeleteHistory).toHaveBeenCalledWith(['one'], 'history-only');
});

test('thin Settings route maps live toggles to persisted settings patches', async () => {
  const view = await renderRoute(SettingsRoute);
  fireEvent(view.getByRole('switch', { name: 'Completion notifications' }), 'valueChange', false);
  expect(mockUpdateSettings).toHaveBeenCalledWith({ alerts: false });
  await userEvent.setup().press(view.getByRole('button', { name: 'Original' }));
  expect(mockUpdateSettings).toHaveBeenCalledWith({ quality: 'original' });
  await userEvent.setup().press(view.getByRole('link', { name: 'Clear temporary files' }));
  expect(mockCleanupTemporary).toHaveBeenCalledTimes(1);
  await userEvent.setup().press(view.getByRole('link', { name: 'Manage save location access' }));
  expect(mockRequestSaveLocationAccess).toHaveBeenCalledTimes(1);
  await userEvent.setup().press(view.getByRole('button', { name: 'Dark' }));
  expect(mockUpdateSettings).toHaveBeenCalledWith({ themeMode: 'dark' });
  await userEvent.setup().press(view.getByRole('link', { name: 'Open Privacy Policy' }));
  await userEvent.setup().press(view.getByRole('link', { name: 'Open Disclaimer' }));
  expect(mockPush).toHaveBeenNthCalledWith(1, '/privacy');
  expect(mockPush).toHaveBeenNthCalledWith(2, '/disclaimer');
});
