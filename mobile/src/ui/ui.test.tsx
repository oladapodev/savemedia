import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  AppThemeProvider,
  Button,
  ChoiceBar,
  EmptyState,
  getResponsiveColumnCount,
  getChoiceBarDirection,
  Icon,
  iconStrokeWidth,
  Inline,
  Screen,
  Stack,
  Surface,
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
  expect(lightTheme.canvas).toBe('#FFFFFF');
  expect(darkTheme.canvas).toBe('#000000');
  expect(lightTheme.accent).toBe('#FA6E09');
  expect(space.md).toBeGreaterThan(space.sm);
});

test('elevation and reduced-motion tokens preserve semantic contracts', () => {
  expect(elevation.flat).toBe(0);
  expect(elevation.raised).toBe(0);
  expect(elevation.floating).toBe(0);
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

test('primary button keeps its intrinsic height and accessible label', async () => {
  await render(
    <AppThemeProvider mode="light">
      <Button label="Download" onPress={() => undefined} />
    </AppThemeProvider>,
  );

  expect(screen.getByRole('button', { name: 'Download' })).toHaveStyle({
    flexShrink: 0,
    maxWidth: '100%',
    minWidth: 0,
  });
  expect(screen.getByText('Download')).toHaveStyle({ flexShrink: 1 });
});

test('vertical layout primitives keep intrinsic height within scroll pages', async () => {
  await render(
    <AppThemeProvider mode="light">
      <Stack testID="stack">
        <Inline testID="inline">
          <Text>Long content</Text>
        </Inline>
        <Surface testID="surface">
          <Text>Long content</Text>
        </Surface>
      </Stack>
    </AppThemeProvider>,
  );

  for (const testID of ['stack', 'surface']) {
    expect(screen.getByTestId(testID)).toHaveStyle({
      flexShrink: 0,
      maxWidth: '100%',
      minWidth: 0,
    });
  }
  expect(screen.getByTestId('inline')).toHaveStyle({ flexShrink: 1 });
});

test('growing stacks can yield horizontal space to trailing controls', async () => {
  await render(<AppThemeProvider mode="light"><Inline><Stack grow testID="growing-stack"><Text>Long title</Text></Stack><Button label="Action" /></Inline></AppThemeProvider>);
  expect(screen.getByTestId('growing-stack')).toHaveStyle({ flex: 1, flexShrink: 1, minWidth: 0 });
});

test('scroll screen content grows beyond the viewport instead of shrinking', async () => {
  const view = await render(
    <AppThemeProvider mode="light">
      <Screen scroll scrollTestID="scroll-content" testID="scroll-screen">
        <Stack><Text>Scrollable content</Text></Stack>
      </Screen>
    </AppThemeProvider>,
  );

  expect(screen.getByTestId('scroll-content').props.contentContainerStyle).toEqual(expect.arrayContaining([
    expect.objectContaining({ flexGrow: 1, flexShrink: 0 }),
  ]));
});

test('pause icons use the shared thin outline stroke', async () => {
  await render(
    <AppThemeProvider mode="dark">
      <Icon name="pause" />
    </AppThemeProvider>,
  );

  expect(screen.toJSON()).toBeTruthy();
  expect(iconStrokeWidth).toBe(1.8);
});

test('choice bar exposes equal accessible options and selection changes', async () => {
  const onChange = jest.fn();
  await render(
    <AppThemeProvider mode="dark">
      <ChoiceBar
        choices={[
          { label: 'All', value: 'all' },
          { label: 'Video', value: 'video' },
          { label: 'Images', value: 'images' },
          { label: 'Audio', value: 'audio' },
        ]}
        onChange={onChange}
        value="video"
      />
    </AppThemeProvider>,
  );

  const options = screen.getAllByRole('button');
  expect(options).toHaveLength(4);
  options.forEach((option) => expect(option).toHaveStyle({ minWidth: 0 }));
  expect(screen.getByRole('button', { name: 'Video' }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  fireEvent.press(screen.getByRole('button', { name: 'Images' }));
  expect(onChange).toHaveBeenCalledWith('images');
});

test('choice bars stack for narrow screens or accessibility text', () => {
  expect(getChoiceBarDirection({ fontScale: 1, width: 320 })).toBe('column');
  expect(getChoiceBarDirection({ fontScale: 1.4, width: 390 })).toBe('column');
  expect(getChoiceBarDirection({ fontScale: 1, width: 390 })).toBe('row');
});

test('empty state renders outlined content and an optional action', async () => {
  const onAction = jest.fn();
  await render(
    <AppThemeProvider mode="light">
      <EmptyState
        action={{ label: 'Try again', onPress: onAction }}
        detail="Paste a supported public link to begin."
        icon="download"
        title="Nothing here yet"
      />
    </AppThemeProvider>,
  );

  expect(screen.getByRole('header', { name: 'Nothing here yet' })).toBeTruthy();
  expect(screen.getByText('Paste a supported public link to begin.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onAction).toHaveBeenCalledTimes(1);
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
