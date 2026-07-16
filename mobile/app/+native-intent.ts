const EXPO_SHARING_INTENT = 'imediasave://expo-sharing';

function isSafeAppPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(path)) return false;
  try {
    const decoded = decodeURIComponent(path);
    return !decoded.startsWith('//') && !/[\\\u0000-\u001f\u007f]/u.test(decoded);
  } catch {
    return false;
  }
}

export async function redirectSystemPath(intent: {
  path: string;
  initial: boolean;
}): Promise<string> {
  if (intent.path === EXPO_SHARING_INTENT) return '/share';
  return isSafeAppPath(intent.path) ? intent.path : '/';
}
