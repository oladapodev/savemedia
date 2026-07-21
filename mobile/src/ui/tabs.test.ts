import { tabItems } from './tabs';

test('primary navigation exposes four stable labeled destinations', () => {
  expect(tabItems.map(({ label }) => label)).toEqual(['Home', 'Downloads', 'History', 'Settings']);
  expect(tabItems.every(({ label }) => /^\w+$/.test(label))).toBe(true);
  expect(new Set(tabItems.map(({ name }) => name)).size).toBe(4);
});
