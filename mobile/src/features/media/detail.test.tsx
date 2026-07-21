import { render, screen, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';
import { getDetailActionDirection, MediaDetailScreen } from './detail';

const preview = {
  id: 'preview', title: 'Sunset vibes', platform: 'Instagram', mediaType: 'Video',
  thumbnailUrl: 'https://images.example/sunset.jpg', quality: 'Balanced' as const,
};

test('preview detail offers quality and one download action', async () => {
  const onDownload = jest.fn();
  const user = userEvent.setup();
  await render(
    <AppThemeProvider mode="light">
      <MediaDetailScreen item={preview} mode="preview" onDownload={onDownload} />
    </AppThemeProvider>,
  );
  expect(screen.getByRole('header', { name: 'Download' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Download media' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share media' })).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Download media' }));
  expect(onDownload).toHaveBeenCalledTimes(1);
});

test('saved detail offers share and open in gallery without download again', async () => {
  await render(
    <AppThemeProvider mode="light">
      <MediaDetailScreen item={preview} mode="saved" />
    </AppThemeProvider>,
  );
  expect(screen.getByRole('button', { name: 'Share media' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open in gallery' })).toBeTruthy();
  expect(screen.queryByText(/download again/i)).toBeNull();
});

test('saved detail stacks paired actions on narrow phones', () => {
  expect(getDetailActionDirection(320)).toBe('column');
  expect(getDetailActionDirection(390)).toBe('row');
});
