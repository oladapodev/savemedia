import { getTabMotion, tabItems } from './tabs';

test('primary navigation exposes four stable labeled destinations', () => {
  expect(tabItems.map(({ label }) => label)).toEqual(['Home', 'Downloads', 'History', 'Settings']);
  expect(tabItems.every(({ label }) => /^\w+$/.test(label))).toBe(true);
  expect(new Set(tabItems.map(({ name }) => name)).size).toBe(4);
});

test('tab motion is fluid by default and instant when motion is disabled', () => {
  expect(getTabMotion(false)).toEqual({
    animation: 'shift',
    transitionSpec: { animation: 'timing', config: { duration: 220 } },
  });
  expect(getTabMotion(true)).toEqual({
    animation: 'none',
    transitionSpec: { animation: 'timing', config: { duration: 0 } },
  });
});
