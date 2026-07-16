import { selectBalanced } from './quality';
import type { MediaVariant } from './types';

const video = (
  id: string,
  height: number,
  reliable = true,
  sizeBytes = height * 1_000,
): MediaVariant => ({
  id,
  mediaType: 'video',
  height,
  reliable,
  sizeBytes,
});

describe('balanced quality policy', () => {
  test('chooses reliable 1080 before 720, larger, or smaller video', () => {
    const quality2160 = video('2160', 2160);
    const quality720 = video('720', 720);
    const quality1080 = video('1080', 1080);
    const quality480 = video('480', 480);

    expect(
      selectBalanced([quality2160, quality720, quality480, quality1080]),
    ).toEqual(quality1080);
  });

  test('chooses reliable 720 when reliable 1080 is unavailable', () => {
    const quality720 = video('720', 720);

    expect(
      selectBalanced([
        video('2160', 2160),
        video('1080-unreliable', 1080, false),
        quality720,
      ]),
    ).toEqual(quality720);
  });

  test('chooses the nearest reliable video below 720', () => {
    const quality540 = video('540', 540);

    expect(
      selectBalanced([video('144', 144), quality540, video('360', 360)]),
    ).toEqual(quality540);
  });

  test('ignores audio-only and unreliable variants', () => {
    const quality480 = video('480', 480);
    const audio: MediaVariant = {
      id: 'audio-lossless',
      mediaType: 'audio',
      reliable: true,
      sizeBytes: 50_000_000,
    };

    expect(
      selectBalanced([audio, video('720-unreliable', 720, false), quality480]),
    ).toEqual(quality480);
  });

  test('does not pick a largest high-resolution result blindly', () => {
    expect(
      selectBalanced([video('4320', 4320), video('2160', 2160)]),
    ).toBeUndefined();
  });

  test('returns undefined when no reliable video option exists', () => {
    const audio: MediaVariant = {
      id: 'audio',
      mediaType: 'audio',
      reliable: true,
    };

    expect(
      selectBalanced([audio, video('480-unreliable', 480, false)]),
    ).toBeUndefined();
    expect(selectBalanced([])).toBeUndefined();
  });

  test('quality preference is independent of file size and input order', () => {
    const quality720 = video('720', 720, true, 90_000_000);
    const quality480 = video('480', 480, true, 1_000_000);

    expect(selectBalanced([quality480, quality720])).toEqual(quality720);
    expect(selectBalanced([quality720, quality480])).toEqual(quality720);
  });
});
