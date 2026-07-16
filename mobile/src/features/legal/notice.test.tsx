import { render, screen, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';

function TestApp({ children }: { children: React.ReactNode }) {
  return <AppThemeProvider mode="light">{children}</AppThemeProvider>;
}

test('ownership metadata accepts only the explicit persisted marker and preserves other metadata', () => {
  let ownership!: typeof import('./ownership');
  expect(() => {
    ownership = require('./ownership');
  }).not.toThrow();

  expect(ownership.hasAcceptedOwnershipNotice({ ownershipNoticeAccepted: true })).toBe(true);
  expect(ownership.hasAcceptedOwnershipNotice({ ownershipNoticeAccepted: 'true' })).toBe(false);
  expect(ownership.hasAcceptedOwnershipNotice({})).toBe(false);
  expect(ownership.acceptOwnershipNotice({ existing: 'kept' })).toEqual({
    existing: 'kept',
    ownershipNoticeAccepted: true,
  });
});

test('ownership notice is accessible, large-text safe, and dispatches one labelled acceptance action', async () => {
  let OwnershipNotice!: typeof import('./notice')['OwnershipNotice'];
  expect(() => {
    OwnershipNotice = require('./notice').OwnershipNotice;
  }).not.toThrow();
  const onAccept = jest.fn();

  await render(
    <TestApp>
      <OwnershipNotice onAccept={onAccept} visible />
    </TestApp>,
  );

  expect(screen.getByRole('alert', { name: 'Responsible use notice' }))
    .toHaveTextContent(/^Responsible use notice$/);
  expect(screen.getByRole('header', { name: 'Before your first download' })).toBeTruthy();
  expect(screen.getByText(/save only content you own or have permission to download/i)).toBeTruthy();
  expect(screen.getByText('Use iMediaSave responsibly')).toBeTruthy();
  expect(screen.getByText(/copyright, privacy, and platform terms/i))
    .not.toHaveProp('accessibilityElementsHidden', true);
  expect(screen.getByTestId('ownership-notice-scroll')).toBeTruthy();

  await userEvent.setup().press(screen.getByRole('button', { name: 'Accept responsible use notice' }));
  expect(onAccept).toHaveBeenCalledTimes(1);
});

test('ownership notice stays out of the accessibility tree when it is not needed', async () => {
  let OwnershipNotice!: typeof import('./notice')['OwnershipNotice'];
  expect(() => {
    OwnershipNotice = require('./notice').OwnershipNotice;
  }).not.toThrow();

  await render(<TestApp><OwnershipNotice onAccept={jest.fn()} visible={false} /></TestApp>);
  expect(screen.queryByRole('alert', { name: 'Responsible use notice' })).toBeNull();
});
