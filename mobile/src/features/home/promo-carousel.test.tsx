import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';
import { getPromoSize, PromoCarousel, shouldAnimateCarouselNavigation } from './promo-carousel';

function TestApp() {
  return <AppThemeProvider mode="light"><PromoCarousel autoAdvanceMs={4_000} /></AppThemeProvider>;
}

afterEach(() => { jest.useRealTimers(); });

test('carousel navigation obeys reduced-motion and screen-reader modes', () => {
  expect(shouldAnimateCarouselNavigation(false)).toBe(true);
  expect(shouldAnimateCarouselNavigation(true)).toBe(false);
});

test('carousel reserves a stable two-to-one image frame', () => {
  expect(getPromoSize(358)).toEqual({ height: 179, width: 358 });
  expect(getPromoSize(0)).toEqual({ height: 1, width: 1 });
});

test('carousel exposes the five supplied promotions and pagination controls', async () => {
  await render(<TestApp />);
  expect(screen.getByLabelText('Promotional highlights')).toBeTruthy();
  expect(screen.queryByText('Promotional highlights')).toBeNull();
  expect(screen.getByLabelText('Save your favorite moments')).toBeTruthy();
  expect(screen.getByLabelText('Download what you love instantly')).toBeTruthy();
  expect(screen.getByLabelText('One link, endless possibilities')).toBeTruthy();
  expect(screen.getByLabelText('Clean downloads without watermarks or ads')).toBeTruthy();
  expect(screen.getByLabelText('Download from social media in one place')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Show promotion 1' }).props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByRole('button', { name: 'Show promotion 5' })).toBeTruthy();
});

test('carousel advances its selected dot automatically', async () => {
  jest.useFakeTimers();
  await render(<TestApp />);
  await act(async () => { jest.advanceTimersByTime(4_000); });
  expect(screen.getByRole('button', { name: 'Show promotion 2' }).props.accessibilityState).toEqual({ selected: true });
});

test('carousel dots navigate directly', async () => {
  await render(<TestApp />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Show promotion 4' })); });
  expect(screen.getByRole('button', { name: 'Show promotion 4' }).props.accessibilityState.selected).toBe(true);
});

test('carousel autoplay can be paused', async () => {
  jest.useFakeTimers();
  await render(<TestApp />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Pause promotions' })); });
  await act(async () => { await jest.advanceTimersByTimeAsync(8_000); });
  expect(screen.getByRole('button', { name: 'Show promotion 1' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByRole('button', { name: 'Resume promotions' })).toBeTruthy();
  expect(screen.queryByText('Resume')).toBeNull();
});
