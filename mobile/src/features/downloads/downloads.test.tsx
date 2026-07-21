import { render, screen, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';
import { DownloadsScreen, type ActiveDownloadItemModel } from './downloads';

const selection = { itemId: 'slide-1', quality: 'balanced' as const, variant: { id: '720p', mediaType: 'video' as const, height: 720, reliable: true } };

const item: ActiveDownloadItemModel = {
  id: 'job-1',
  title: 'sunset-video.mp4',
  platform: 'Instagram',
  status: 'Downloading',
  progress: 42,
};

test('downloads shows a simple active queue with progress and cancel', async () => {
  const onCancel = jest.fn();
  const user = userEvent.setup();
  await render(
    <AppThemeProvider mode="light">
      <DownloadsScreen items={[item]} onCancel={onCancel} />
    </AppThemeProvider>,
  );

  expect(screen.getByRole('header', { name: 'Downloads' })).toBeTruthy();
  expect(screen.getByText('42%')).toBeTruthy();
  expect(screen.queryByText('Videos')).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Cancel sunset-video.mp4' }));
  expect(onCancel).toHaveBeenCalledWith(item);
});

test('downloads has a useful empty state', async () => {
  await render(
    <AppThemeProvider mode="light">
      <DownloadsScreen items={[]} />
    </AppThemeProvider>,
  );
  expect(screen.getByText('No active downloads')).toBeTruthy();
  expect(screen.getByLabelText('No active downloads illustration')).toBeTruthy();
});

test('selection-required downloads expose media choices', async () => {
  const onChoose = jest.fn();
  const choiceItem: ActiveDownloadItemModel = { id: item.id, title: item.title, platform: item.platform, status: 'Selection required',
    choices: [{ id: 'slide-1:720p', label: 'Item 1 · 720p video', selection }] };
  const user = userEvent.setup();
  await render(<AppThemeProvider mode="light"><DownloadsScreen items={[choiceItem]} onChoose={onChoose} /></AppThemeProvider>);
  await user.press(screen.getByRole('button', { name: 'Item 1 · 720p video' }));
  expect(onChoose).toHaveBeenCalledWith(choiceItem, selection);
});
