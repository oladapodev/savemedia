import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppDataProvider } from '../src/history/db';
import { DownloadProvider } from '../src/downloads/context';
import { NotificationEdge } from '../src/notifications/edge';
import { usePendingNativeShare } from '../src/platform/incoming-share';
import { useTheme } from '../src/ui';

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const router = useRouter();
  const openHistory = useCallback(() => router.push('/history'), [router]);
  const openShare = useCallback(() => router.replace('/share'), [router]);
  usePendingNativeShare(openShare);
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <DownloadProvider>
          <ThemedStatusBar />
          <NotificationEdge openHistory={openHistory} />
          <Stack screenOptions={{ headerShown: false }} />
        </DownloadProvider>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}
