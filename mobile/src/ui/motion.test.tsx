import { render, screen } from '@testing-library/react-native';

import { MotionPressable, Reveal, resolveMotion } from './motion';

test('motion policy keeps feedback short and removes decorative motion when requested', () => {
  expect(resolveMotion(false)).toEqual({ feedbackDuration: 120, stateDuration: 220, decorativeDistance: 10 });
  expect(resolveMotion(true)).toEqual({ feedbackDuration: 0, stateDuration: 0, decorativeDistance: 0 });
});

test('motion primitives preserve accessible controls and content', async () => {
  await render(
    <Reveal><MotionPressable accessibilityLabel="Animated action" accessibilityRole="button"><></></MotionPressable></Reveal>,
  );

  expect(screen.getByRole('button', { name: 'Animated action' })).toBeTruthy();
});
