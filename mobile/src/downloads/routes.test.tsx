import { fireEvent, render, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppThemeProvider } from '../ui';

const mockPasteAndDownload = jest.fn();
const mockStartSharedUrl = jest.fn().mockResolvedValue(undefined);
const mockDeleteHistory = jest.fn().mockResolvedValue({ deletedIds: ['one'], failures: [] });
const mockUpdateSettings = jest.fn().mockResolvedValue(undefined);
const mockCleanupTemporary = jest.fn().mockResolvedValue(undefined);
const mockRequestSaveLocationAccess = jest.fn().mockResolvedValue(undefined);
const mockPush = jest.fn();
let capturedHomeProps: {
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onSubmitUrl?: (url: string) => Promise<void> | void;
} | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../src/features/home/home', () => ({
  HomeScreen: (props: unknown) => {
    capturedHomeProps = props as typeof capturedHomeProps;
    return <Text>home</Text>;
  },
}));

jest.mock('./context', () => ({
  useDownloads: () => ({
    home: {
      cardDetail: 'Copy a public link.', cardTitle: 'Save media from a link', phase: 'ready',
      primaryAction: { label: 'Paste & download' }, statusDetail: 'Clipboard on tap.', statusText: 'Ready',
    },
    history: {
      items: [{
        id: 'one', title: 'one.mp4', sourceLabel: 'Instagram', detail: 'Video', dateLabel: 'Today',
        status: 'Saved', assetUri: 'ph://one', sourceUrl: 'https://instagram.com/reel/one',
      }],
    },
    settings: {
      allowCellular: true, appVersion: '1.0.0', notifications: true,
      quality: 'Balanced', saveLocation: 'Photos & media library', smartAutoSave: true,
    },
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
});

test('thin Home route renders the live provider model and dispatches paste intent', async () => {
  const view = await renderRoute(HomeRoute);
  expect(view.getByText('home')).toBeTruthy();
  expect(capturedHomeProps?.onPrimaryAction?.()).toBeUndefined();
  expect(mockPasteAndDownload).toHaveBeenCalledTimes(1);
});

test('thin Home route ignores provider-unmounted submit rejections', async () => {
  mockStartSharedUrl.mockRejectedValueOnce(new Error('Download provider unmounted before initialization completed.'));
  const view = await renderRoute(HomeRoute);
  expect(view.getByText('home')).toBeTruthy();

  expect(capturedHomeProps?.onSubmitUrl?.('https://example.com/shared')).toBeUndefined();
  expect(mockStartSharedUrl).toHaveBeenCalledWith('https://example.com/shared');
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
  await userEvent.setup().press(view.getByRole('button', { name: 'Change default quality' }));
  expect(mockUpdateSettings).toHaveBeenCalledWith({ quality: 'original' });
  await userEvent.setup().press(view.getByRole('button', { name: 'Clear temporary files' }));
  expect(mockCleanupTemporary).toHaveBeenCalledTimes(1);
  await userEvent.setup().press(view.getByRole('button', { name: 'Manage save location access' }));
  expect(mockRequestSaveLocationAccess).toHaveBeenCalledTimes(1);
  await userEvent.setup().press(view.getByRole('link', { name: 'Open Privacy Policy' }));
  await userEvent.setup().press(view.getByRole('link', { name: 'Open Disclaimer' }));
  expect(mockPush).toHaveBeenNthCalledWith(1, '/privacy');
  expect(mockPush).toHaveBeenNthCalledWith(2, '/disclaimer');
});
