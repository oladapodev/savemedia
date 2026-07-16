import { render, screen, userEvent } from '@testing-library/react-native';

import { AppThemeProvider } from '../../ui';
import {
  HomeScreen,
  downloadingHomeModel,
  readyHomeModel,
  type HomeScreenModel,
} from './home';

function TestApp({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider mode="light">{children}</AppThemeProvider>
  );
}

test('home presents one primary paste action with honest support and legal copy', async () => {
  await render(
    <TestApp>
      <HomeScreen model={readyHomeModel} />
    </TestApp>,
  );

  expect(screen.getByRole('header', { name: 'iMediaSave' })).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(3);
  expect(screen.getByPlaceholderText('Paste a public link')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Paste' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Download link' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Paste & download' })).toBeTruthy();
  expect(
    screen.getByText('Popular platforms and compatible public links.'),
  ).toBeTruthy();
  expect(
    screen.getByText('Save only content you own or have permission to download.'),
  ).toBeTruthy();
  expect(screen.getByText('Ready to download')).toBeTruthy();
});

test('home exposes a visible link field for manual pastes', async () => {
  await render(
    <TestApp>
      <HomeScreen model={readyHomeModel} />
    </TestApp>,
  );

  expect(screen.getByPlaceholderText('Paste a public link')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Paste' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Download link' })).toBeTruthy();
});

test('home exposes determinate progress with icon-independent status text', async () => {
  await render(
    <TestApp>
      <HomeScreen model={downloadingHomeModel} />
    </TestApp>,
  );

  const progress = screen.getByRole('progressbar', { name: 'Download progress' });

  expect(progress).toHaveAccessibilityValue({
    min: 0,
    max: 100,
    now: 42,
  });
  expect(progress).toHaveProp('accessibilityLiveRegion', 'none');
  expect(screen.getByText('Downloading · 42%', {
    includeHiddenElements: true,
  })).toHaveProp(
    'accessibilityElementsHidden',
    true,
  );
  expect(screen.getByText('Your download can continue in the background.')).toBeTruthy();
});

const stateCases: Array<{
  model: HomeScreenModel;
  primary: string;
  secondary?: string;
}> = [
  {
    model: {
      phase: 'ready',
      cardTitle: 'Save media from a link',
      cardDetail: 'Paste a compatible public link.',
      primaryAction: { label: 'Paste & download' },
      statusText: 'Ready to download',
      statusDetail: 'Clipboard access starts after the tap.',
    },
    primary: 'Paste & download',
  },
  {
    model: {
      phase: 'link_detected',
      cardTitle: 'Link detected',
      cardDetail: 'Instagram public link',
      primaryAction: { label: 'Download' },
      secondaryAction: { label: 'Change link' },
      statusText: 'Ready to inspect',
      statusDetail: 'Balanced quality will be preferred.',
    },
    primary: 'Download',
    secondary: 'Change link',
  },
  {
    model: {
      phase: 'preparing',
      cardTitle: 'Preparing download',
      cardDetail: 'Checking available media.',
      primaryAction: { label: 'Cancel' },
      statusText: 'Preparing',
      statusDetail: 'This usually takes a moment.',
    },
    primary: 'Cancel',
  },
  {
    model: {
      phase: 'selection_required',
      cardTitle: 'Choose media',
      cardDetail: 'Select the items you want to save.',
      primaryAction: { label: 'Continue' },
      secondaryAction: { label: 'Cancel' },
      statusText: 'Selection required',
      statusDetail: 'Nothing downloads until you continue.',
    },
    primary: 'Continue',
    secondary: 'Cancel',
  },
  {
    model: downloadingHomeModel,
    primary: 'Cancel download',
  },
  {
    model: {
      phase: 'paused_offline',
      cardTitle: 'Download paused',
      cardDetail: 'Reconnect to continue saving.',
      primaryAction: { label: 'Retry now' },
      secondaryAction: { label: 'Cancel download' },
      statusText: 'Waiting for a connection',
      statusDetail: 'Progress is safely paused.',
    },
    primary: 'Retry now',
    secondary: 'Cancel download',
  },
  {
    model: {
      phase: 'complete',
      cardTitle: 'Saved to your device',
      cardDetail: 'summer-reel.mp4 is ready.',
      primaryAction: { label: 'View' },
      secondaryAction: { label: 'Share' },
      statusText: 'Download complete',
      statusDetail: 'The file is available on this device.',
    },
    primary: 'View',
    secondary: 'Share',
  },
  {
    model: {
      phase: 'failed',
      cardTitle: 'Could not save media',
      cardDetail: 'The provider did not respond.',
      primaryAction: { label: 'Retry' },
      secondaryAction: { label: 'Try another link' },
      statusText: 'Download failed',
      statusDetail: 'Your link is still available.',
    },
    primary: 'Retry',
    secondary: 'Try another link',
  },
];

test.each(stateCases)(
  'home exposes the intended actions for $model.phase',
  async ({ model, primary, secondary }) => {
    await render(
      <TestApp>
        <HomeScreen model={model} />
      </TestApp>,
    );

    expect(screen.getByRole('button', { name: primary })).toBeTruthy();
    if (secondary) {
      expect(screen.getByRole('button', { name: secondary })).toBeTruthy();
    }
  },
);

test('complete home state dispatches View and Share separately', async () => {
  const onPrimaryAction = jest.fn();
  const onSecondaryAction = jest.fn();
  const completeModel = stateCases.find(({ model }) => model.phase === 'complete')!.model;
  const user = userEvent.setup();

  await render(
    <TestApp>
      <HomeScreen
        model={completeModel}
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
      />
    </TestApp>,
  );

  await user.press(screen.getByRole('button', { name: 'View' }));
  await user.press(screen.getByRole('button', { name: 'Share' }));

  expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  expect(onSecondaryAction).toHaveBeenCalledTimes(1);
});

test('selection-required home state dispatches the chosen serializable media option', async () => {
  const selection = {
    itemId: 'item-2',
    quality: 'original' as const,
    variant: { id: 'variant-2', mediaType: 'image' as const, reliable: true },
  };
  const onChooseMedia = jest.fn();
  const user = userEvent.setup();

  await render(
    <TestApp>
      <HomeScreen
        model={{
          phase: 'selection_required',
          cardTitle: 'Choose media',
          cardDetail: 'Select an item.',
          primaryAction: { label: 'Continue' },
          statusText: 'Selection required',
          statusDetail: 'Choose one item.',
          mediaChoices: [{ id: 'item-2', label: 'Image 2', selection }],
        }}
        onChooseMedia={onChooseMedia}
      />
    </TestApp>,
  );

  await user.press(screen.getByRole('button', { name: 'Choose Image 2' }));
  expect(onChooseMedia).toHaveBeenCalledWith(selection);
});
