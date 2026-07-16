import { redirectSystemPath } from '../../app/+native-intent';

test('rewrites only the exact Expo Sharing SDK 57 scheme and host form', async () => {
  await expect(redirectSystemPath({ path: 'imediasave://expo-sharing', initial: true }))
    .resolves.toBe('/share');

  await expect(redirectSystemPath({ path: 'IMEDIASAVE://expo-sharing', initial: false }))
    .resolves.toBe('/');
  await expect(redirectSystemPath({ path: 'imediasave://expo-sharing.evil.test', initial: false }))
    .resolves.toBe('/');
  await expect(redirectSystemPath({ path: 'imediasave://expo-sharing/path', initial: false }))
    .resolves.toBe('/');
  await expect(redirectSystemPath({ path: 'imediasave://expo-sharing?next=evil', initial: false }))
    .resolves.toBe('/');
  await expect(redirectSystemPath({ path: 'https://example.com/expo-sharing', initial: false }))
    .resolves.toBe('/');
});

test('preserves safe app paths and falls home for unsafe system paths', async () => {
  await expect(redirectSystemPath({ path: '/', initial: true })).resolves.toBe('/');
  await expect(redirectSystemPath({ path: '/history?from=notification', initial: false }))
    .resolves.toBe('/history?from=notification');
  await expect(redirectSystemPath({ path: '//evil.test/path', initial: false })).resolves.toBe('/');
  await expect(redirectSystemPath({ path: '/\\evil', initial: false })).resolves.toBe('/');
  await expect(redirectSystemPath({ path: '/history\n/settings', initial: false })).resolves.toBe('/');
  await expect(redirectSystemPath({ path: 'not-a-path', initial: false })).resolves.toBe('/');
});
