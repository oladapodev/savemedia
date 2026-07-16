import { render, screen } from '@testing-library/react-native';

import {
  AppThemeProvider,
  Button,
  getResponsiveColumnCount,
  Screen,
  Text,
} from '.';
import {
  darkTheme,
  elevation,
  lightTheme,
  motion,
  space,
} from './tokens';

test('themes expose the same semantic color keys', () => {
  expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort());
  expect(space.md).toBeGreaterThan(space.sm);
});

test('elevation and reduced-motion tokens preserve semantic contracts', () => {
  expect(elevation.raised).toBeGreaterThan(elevation.flat);
  expect(elevation.floating).toBeGreaterThan(elevation.raised);
  expect(Object.keys(motion.reduced).sort()).toEqual(
    Object.keys(motion.standard).sort(),
  );
  expect(motion.reduced.stateDuration).toBe(0);
  expect(motion.standard.stateDuration).toBeGreaterThan(0);
});

test('responsive grids use one column on narrow or large-text layouts', () => {
  expect(getResponsiveColumnCount({ width: 390, fontScale: 1 })).toBe(1);
  expect(getResponsiveColumnCount({ width: 800, fontScale: 1.4 })).toBe(1);
  expect(getResponsiveColumnCount({ width: 800, fontScale: 1 })).toBe(2);
});

test('primary button exposes an accessible role and label', async () => {
  await render(
    <AppThemeProvider mode="light">
      <Button label="Download" onPress={() => undefined} />
    </AppThemeProvider>,
  );

  expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
});

test('screen composes semantic text without route-owned styles', async () => {
  await render(
    <AppThemeProvider mode="light">
      <Screen>
        <Text variant="title">History</Text>
      </Screen>
    </AppThemeProvider>,
  );

  expect(screen.getByText('History')).toBeTruthy();
});
