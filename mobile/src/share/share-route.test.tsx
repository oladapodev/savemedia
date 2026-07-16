import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { IncomingShareAdapterResult } from '../platform/incoming-share';

import ShareRoute from '../../app/share';
import { AppThemeProvider } from '../ui';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockClear = jest.fn();
const mockStartSharedUrl = jest.fn();
const mockSaveSharedFiles = jest.fn();
const mockDiscardIncomingShare = jest.fn();
const mockDownloads = {
  startSharedUrl: mockStartSharedUrl,
  saveSharedFiles: mockSaveSharedFiles,
  discardIncomingShare: mockDiscardIncomingShare,
};
let mockIncomingShare: IncomingShareAdapterResult;

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../platform/incoming-share', () => ({
  useIncomingShareAdapter: () => mockIncomingShare,
}));

jest.mock('../downloads/context', () => ({
  useDownloads: () => mockDownloads,
}));

function urlShare(url: string): IncomingShareAdapterResult {
  return {
    sharedPayloads: [{ value: url, shareType: 'url', mimeType: 'text/plain' }],
    resolvedSharedPayloads: [{
      value: url, shareType: 'url', mimeType: 'text/plain', contentUri: url,
      contentType: 'website', contentMimeType: 'text/html', originalName: null, contentSize: null,
    }],
    clearSharedPayloads: mockClear,
    isResolving: false,
    error: null,
    refreshSharePayloads: jest.fn(),
  };
}

function mediaShare(uri: string, mimeType = 'image/jpeg'): IncomingShareAdapterResult {
  return {
    sharedPayloads: [{ value: uri, shareType: 'image', mimeType }],
    resolvedSharedPayloads: [{
      value: uri, shareType: 'image', mimeType, contentUri: uri,
      contentType: 'image', contentMimeType: mimeType, originalName: 'photo.jpg', contentSize: 128,
    }],
    clearSharedPayloads: mockClear,
    isResolving: false,
    error: null,
    refreshSharePayloads: jest.fn(),
  };
}

async function renderRoute() {
  return render(
    <AppThemeProvider mode="light">
      <ShareRoute />
    </AppThemeProvider>,
  );
}

async function flushShareMicrotasks() {
  for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
}

async function settleShareOperation() {
  await act(flushShareMicrotasks);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockDiscardIncomingShare.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('consumes a shared URL once, truthfully confirms a queued download, then clears and routes home', async () => {
  mockIncomingShare = urlShare('https://example.com/route-one');
  let finish!: (value: unknown) => void;
  mockStartSharedUrl.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

  await renderRoute();
  expect(screen.getByRole('header', { name: 'Saving shared media' })).toBeTruthy();
  expect(mockClear).not.toHaveBeenCalled();

  await act(async () => {
    finish({ kind: 'started', job: { status: 'downloading' } });
    await flushShareMicrotasks();
  });

  expect(screen.getByRole('header', { name: 'Download started' })).toBeTruthy();
  expect(screen.getByText('Your shared link is queued and continues on Home.')).toBeTruthy();
  expect(mockClear).not.toHaveBeenCalled();
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockStartSharedUrl).toHaveBeenCalledTimes(1);
  expect(mockStartSharedUrl).toHaveBeenCalledWith('https://example.com/route-one');
  expect(mockReplace).toHaveBeenCalledWith('/');

  expect(mockStartSharedUrl).toHaveBeenCalledTimes(1);
  expect(mockClear).toHaveBeenCalledTimes(1);
});

test('routes a recorded selection-required media set home without clearing its Home state', async () => {
  const first = mediaShare('content://share/selection-one');
  const second = mediaShare('content://share/selection-two');
  mockIncomingShare = {
    ...first,
    sharedPayloads: [...first.sharedPayloads, ...second.sharedPayloads],
    resolvedSharedPayloads: [...first.resolvedSharedPayloads, ...second.resolvedSharedPayloads],
  };
  mockSaveSharedFiles.mockResolvedValue({ kind: 'selection_required', job: { status: 'selection_required' } });

  await renderRoute();
  await settleShareOperation();

  await waitFor(() => expect(mockSaveSharedFiles).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('header', { name: 'Choose shared media' })).toBeTruthy();
  expect(mockClear).not.toHaveBeenCalled();
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/');
  expect(mockSaveSharedFiles).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ sourceUri: 'content://share/selection-one' }),
    expect.objectContaining({ sourceUri: 'content://share/selection-two' }),
  ]));
});

test('records and clears a rejection once while keeping an accessible rejection state visible', async () => {
  mockIncomingShare = mediaShare('file:///group/unsafe-svg', 'image/svg+xml');

  await renderRoute();
  await settleShareOperation();

  await waitFor(() => expect(screen.getByRole('header', { name: 'Cannot save this share' })).toBeTruthy());
  expect(screen.getByText('Only supported image and video formats can be saved.')).toBeTruthy();
  expect(mockDiscardIncomingShare).toHaveBeenCalledWith(['file:///group/unsafe-svg']);
  expect(mockClear).not.toHaveBeenCalled();
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockStartSharedUrl).not.toHaveBeenCalled();
  expect(mockSaveSharedFiles).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test('confirms a completed direct share as saved rather than merely queued', async () => {
  mockIncomingShare = mediaShare('content://share/photo');
  mockSaveSharedFiles.mockResolvedValue({ kind: 'started', job: { status: 'complete' } });

  await renderRoute();
  await settleShareOperation();
  await waitFor(() => expect(screen.getByRole('header', { name: 'Saved to device' })).toBeTruthy());
  expect(screen.getByText('The shared media is saved in your library.')).toBeTruthy();
  expect(mockClear).not.toHaveBeenCalled();
});

test('awaits native queue consumption before navigating and surfaces a retryable cleanup failure', async () => {
  jest.useRealTimers();
  mockIncomingShare = urlShare('https://example.com/retry-cleanup');
  let finish!: (value: unknown) => void;
  mockStartSharedUrl.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  mockClear
    .mockRejectedValueOnce(new Error('Native share queue is busy.'))
    .mockResolvedValueOnce(undefined);
  await renderRoute();
  await act(async () => {
    finish({ kind: 'started', job: { status: 'downloading' } });
    await flushShareMicrotasks();
  });
  await waitFor(() => expect(screen.getByRole('header', { name: 'Download started' })).toBeTruthy());

  expect(mockReplace).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('header', { name: 'Shared media still pending' })).toBeTruthy(), {
    timeout: 1_500,
  });
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Native share queue is busy.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry cleanup' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'), { timeout: 1_500 });
  expect(mockClear).toHaveBeenCalledTimes(2);
});

test('cancels its confirmation timer when the share route unmounts', async () => {
  jest.useRealTimers();
  mockIncomingShare = urlShare('https://example.com/unmount');
  let finish!: (value: unknown) => void;
  mockStartSharedUrl.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

  const view = await renderRoute();
  await act(async () => {
    finish({ kind: 'started', job: { status: 'downloading' } });
    await flushShareMicrotasks();
  });
  expect(screen.getByRole('header', { name: 'Download started' })).toBeTruthy();
  await view.unmount();
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(mockClear).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
