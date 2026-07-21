import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../ui';
import { downloadingHomeModel, getHomeFormDirection, getHomeHeaderTopPadding, HomeScreen, isPreviewableUrl, readyHomeModel } from './home';

const mockClipboard = jest.fn().mockResolvedValue('https://instagram.com/reel/one');
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboard() }));

beforeEach(() => { mockClipboard.mockReset().mockResolvedValue('https://instagram.com/reel/one'); });

function TestApp({ children }: { children: React.ReactNode }) {
  return <SafeAreaProvider initialMetrics={{ frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } }}>
    <AppThemeProvider mode="light">{children}</AppThemeProvider>
  </SafeAreaProvider>;
}

test('home presents a rounded orange hero with an overlapping white download card', async () => {
  await render(<TestApp><HomeScreen model={readyHomeModel} /></TestApp>);
  expect(screen.getByRole('header', { name: 'iMediaSave' })).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId('home-hero').props.style)).toEqual(expect.objectContaining({
    backgroundColor: '#FA6E09', borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  }));
  expect(StyleSheet.flatten(screen.getByTestId('home-logo-tile').props.style)).toEqual(expect.objectContaining({
    backgroundColor: '#FFFFFF', borderRadius: 18,
  }));
  expect(StyleSheet.flatten(screen.getByTestId('home-download-card').props.style)).toEqual(expect.objectContaining({ marginTop: -44 }));
  expect(screen.getByLabelText('iMediaSave logo')).toBeTruthy();
  expect(screen.getByPlaceholderText('Paste link here…')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Paste' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Preview download' })).toBeTruthy();
  expect(screen.getByText('Fast Downloads')).toBeTruthy();
  expect(screen.getByText('High Quality')).toBeTruthy();
  expect(screen.getByText('100% Secure')).toBeTruthy();
  expect(screen.getByLabelText('Promotional highlights')).toBeTruthy();
  expect(screen.queryByText('Promotional highlights')).toBeNull();
  expect(screen.getByLabelText('Save your favorite moments')).toBeTruthy();
  expect(screen.getByText('How it works')).toBeTruthy();
  expect(screen.getByText('Paste & preview')).toBeTruthy();
}, 15_000);

test('home form stacks only on narrow phones', () => {
  expect(getHomeFormDirection(320)).toBe('column');
  expect(getHomeFormDirection(390)).toBe('row');
  expect(getHomeHeaderTopPadding(44)).toBe(52);
  expect(isPreviewableUrl('https://instagram.com/reel/one')).toBe(true);
  expect(isPreviewableUrl('javascript:alert(1)')).toBe(false);
  expect(isPreviewableUrl('not a link')).toBe(false);
});

test('home keeps model-driven download progress and actions', async () => {
  const onPrimaryAction = jest.fn();
  const user = userEvent.setup();
  await render(<TestApp><HomeScreen model={downloadingHomeModel} onPrimaryAction={onPrimaryAction} /></TestApp>);
  expect(screen.getByLabelText('Download progress')).toHaveAccessibilityValue({ min: 0, max: 100, now: 42 });
  expect(screen.getByText('Download in progress')).toBeTruthy();
  await user.press(screen.getByRole('button', { name: 'Cancel download' }));
  expect(onPrimaryAction).toHaveBeenCalledTimes(1);
});

test('home reads the clipboard only after Paste is pressed', async () => {
  const user = userEvent.setup();
  await render(<TestApp><HomeScreen model={readyHomeModel} /></TestApp>);
  expect(mockClipboard).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'Paste' }));
  expect(mockClipboard).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue('https://instagram.com/reel/one')).toBeTruthy();
});

test('home submits a typed link for preview', async () => {
  const onSubmitUrl = jest.fn();
  await render(<TestApp><HomeScreen model={readyHomeModel} onSubmitUrl={onSubmitUrl} /></TestApp>);
  await act(async () => { fireEvent.changeText(screen.getByPlaceholderText('Paste link here…'), ' https://youtube.com/watch?v=one '); });
  fireEvent.press(screen.getByRole('button', { name: 'Preview download' }));
  expect(onSubmitUrl).toHaveBeenCalledWith('https://youtube.com/watch?v=one');
});

test('home rejects an invalid link before submitting', async () => {
  const onSubmitUrl = jest.fn();
  await render(<TestApp><HomeScreen model={readyHomeModel} onSubmitUrl={onSubmitUrl} /></TestApp>);
  await act(async () => { fireEvent.changeText(screen.getByPlaceholderText('Paste link here…'), 'not a link'); });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Preview download' })); });
  expect(onSubmitUrl).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').props.children).toContain('Enter a complete public link');
});

test('home shows inspection progress and prevents duplicate submissions', async () => {
  let resolveSubmit!: () => void;
  const onSubmitUrl = jest.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve; }));
  await render(<TestApp><HomeScreen model={readyHomeModel} onSubmitUrl={onSubmitUrl} /></TestApp>);
  await act(async () => { fireEvent.changeText(screen.getByPlaceholderText('Paste link here…'), 'https://example.com/video'); });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Preview download' })); });
  expect(screen.getByRole('button', { name: 'Preview download' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Preview download' }));
  expect(onSubmitUrl).toHaveBeenCalledTimes(1);
  await act(async () => { resolveSubmit(); });
});

test('home presents clipboard failures without rejecting the press action', async () => {
  mockClipboard.mockRejectedValueOnce(new Error('clipboard unavailable'));
  const user = userEvent.setup();
  await render(<TestApp><HomeScreen model={readyHomeModel} /></TestApp>);
  await user.press(screen.getByRole('button', { name: 'Paste' }));
  expect(screen.getByRole('alert').props.children).toContain('Could not read your clipboard');
});
