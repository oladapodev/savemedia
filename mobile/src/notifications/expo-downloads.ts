import * as Notifications from 'expo-notifications';

import { createDownloadNotifications } from './downloads';

export const expoDownloadNotifications = createDownloadNotifications({
  getPermission: () => Notifications.getPermissionsAsync(),
  requestPermission: () => Notifications.requestPermissionsAsync(),
  async ensureDownloadChannel() {
    await Notifications.setNotificationChannelAsync('downloads', {
      name: 'Download completions',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  },
  schedule: (notification) => Notifications.scheduleNotificationAsync({
    content: notification,
    trigger: { channelId: 'downloads' },
  }),
});

export const expoNotificationLifecycle = {
  configureForegroundHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  },
  addResponseListener(listener: (data: Record<string, unknown>) => void) {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      listener(response.notification.request.content.data ?? {});
    });
    return () => subscription.remove();
  },
};
