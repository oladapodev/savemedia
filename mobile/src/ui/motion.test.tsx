import { render, screen } from '@testing-library/react-native';

import { capRevealDelay, getRevealInitialProgress, isMotionDisabled, MotionPressable, Reveal, resolveMotion } from './motion';

test('motion policy keeps feedback short and removes decorative motion when requested', () => {
  expect(resolveMotion(false)).toEqual({ feedbackDuration: 120, stateDuration: 220, decorativeDistance: 10 });
  expect(resolveMotion(true)).toEqual({ feedbackDuration: 0, stateDuration: 0, decorativeDistance: 0 });
});

test('either accessibility preference independently disables decorative motion', () => {
  expect(isMotionDisabled(true, false)).toBe(true);
  expect(isMotionDisabled(false, true)).toBe(true);
  expect(isMotionDisabled(false, false)).toBe(false);
  expect(isMotionDisabled(null, null)).toBe(true);
});

test('reveal staging never exceeds the approved forty millisecond cap', () => {
  expect(capRevealDelay(20)).toBe(20);
  expect(capRevealDelay(80)).toBe(40);
});

test('reveals wait for preferences so standard motion still has an entrance', () => {
  expect(getRevealInitialProgress(false, true)).toBe(0);
  expect(getRevealInitialProgress(true, true)).toBe(1);
  expect(getRevealInitialProgress(true, false)).toBe(0);
});

test('motion primitives preserve accessible controls and content', async () => {
  await render(
    <Reveal><MotionPressable accessibilityLabel="Animated action" accessibilityRole="button"><></></MotionPressable></Reveal>,
  );

  expect(screen.getByRole('button', { name: 'Animated action' })).toBeTruthy();
});
