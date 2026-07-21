import { render, screen, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';
import { HistoryScreen, type HistoryItemModel } from './history';

const item: HistoryItemModel = {
  id: 'summer-reel',
  title: 'Summer reel',
  sourceLabel: 'Instagram',
  detail: 'Video · 1080p · 18 MB',
  dateLabel: 'Today',
  status: 'Saved',
};

const failedItem: HistoryItemModel = {
  ...item,
  id: 'failed-reel',
  status: 'Failed',
  title: 'Failed reel',
  retryable: true,
};

function TestApp({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider mode="light">{children}</AppThemeProvider>
  );
}

test('history explains local storage and exposes selection', async () => {
  await render(
    <TestApp>
      <HistoryScreen items={[]} />
    </TestApp>,
  );

  expect(screen.getByRole('header', { name: 'History' })).toBeTruthy();
  expect(screen.getByText('Finished activity on this device')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Select downloads' })).toBeTruthy();
  expect(
    screen.getByText('Completed and failed downloads will appear here.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Nothing saved yet illustration')).toBeTruthy();
});

test('history items remain operable by name without relying on their thumbnails', async () => {
  const onOpenItem = jest.fn();
  const onShareItem = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestApp>
      <HistoryScreen
        items={[item]}
        onOpenItem={onOpenItem}
        onShareItem={onShareItem}
      />
    </TestApp>,
  );

  expect(screen.getByText('Today')).toBeTruthy();
  expect(screen.getByText('Video · 1080p · 18 MB')).toBeTruthy();

  await user.press(screen.getByRole('button', { name: 'Open Summer reel' }));
  await user.press(screen.getByRole('button', { name: 'Share Summer reel' }));

  expect(onOpenItem).toHaveBeenCalledWith(item);
  expect(onShareItem).toHaveBeenCalledWith(item);
});

test('history selection exposes a labeled bulk action', async () => {
  await render(
    <TestApp>
      <HistoryScreen items={[item]} selectedIds={[item.id]} selecting />
    </TestApp>,
  );

  expect(screen.getByText('1 selected')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remove selected from history' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Delete selected from device and history' })).toBeTruthy();
});

test('history dispatches the two explicit deletion choices', async () => {
  const onDeleteSelected = jest.fn();
  const user = userEvent.setup();
  await render(
    <TestApp>
      <HistoryScreen
        items={[item]}
        onDeleteSelected={onDeleteSelected}
        selectedIds={[item.id]}
        selecting
      />
    </TestApp>,
  );

  await user.press(screen.getByRole('button', { name: 'Remove selected from history' }));
  await user.press(screen.getByRole('button', { name: 'Delete selected from device and history' }));

  expect(onDeleteSelected).toHaveBeenNthCalledWith(1, [item.id], 'history-only');
  expect(onDeleteSelected).toHaveBeenNthCalledWith(2, [item.id], 'device-and-history');
});

test('selection mode toggles items instead of opening or sharing them', async () => {
  const onToggleItem = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestApp>
      <HistoryScreen
        items={[item]}
        onToggleItem={onToggleItem}
        selecting
      />
    </TestApp>,
  );

  expect(screen.queryByRole('button', { name: 'Open Summer reel' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Share Summer reel' })).toBeNull();

  await user.press(screen.getByRole('button', { name: 'Select Summer reel' }));

  expect(onToggleItem).toHaveBeenCalledWith(item);
});

test('selected history items expose an explicit deselect action', async () => {
  await render(
    <TestApp>
      <HistoryScreen items={[item]} selectedIds={[item.id]} selecting />
    </TestApp>,
  );

  expect(screen.getByRole('button', { name: 'Deselect Summer reel' })).toBeTruthy();
});

test('failed history items expose retry instead of saved-media controls', async () => {
  const onRetryItem = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestApp>
      <HistoryScreen items={[failedItem]} onRetryItem={onRetryItem} />
    </TestApp>,
  );

  expect(screen.queryByRole('button', { name: 'Open Failed reel' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Share Failed reel' })).toBeNull();

  await user.press(screen.getByRole('button', { name: 'Retry Failed reel' }));

  expect(onRetryItem).toHaveBeenCalledWith(failedItem);
});

test('permanent failures do not expose a dead retry action', async () => {
  await render(<TestApp><HistoryScreen items={[{ ...failedItem, retryable: false }]} /></TestApp>);
  expect(screen.queryByRole('button', { name: 'Retry Failed reel' })).toBeNull();
});
