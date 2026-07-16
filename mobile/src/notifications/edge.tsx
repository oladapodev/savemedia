import { useEffect } from 'react';

import {
  startDownloadNotificationLifecycle,
  type NotificationLifecycleDependencies,
} from './downloads';

type NotificationEdgeProps = {
  lifecycle?: NotificationLifecycleDependencies;
  openHistory: (jobId: string) => void;
};

function LifecycleEdge({
  lifecycle,
  openHistory,
}: {
  lifecycle: NotificationLifecycleDependencies;
  openHistory: (jobId: string) => void;
}) {
  useEffect(() => startDownloadNotificationLifecycle(lifecycle, openHistory), [lifecycle, openHistory]);
  return null;
}

export function NotificationEdge({
  lifecycle,
  openHistory,
}: NotificationEdgeProps) {
  const activeLifecycle = lifecycle
    ?? (require('./expo-downloads') as typeof import('./expo-downloads')).expoNotificationLifecycle;
  return <LifecycleEdge lifecycle={activeLifecycle} openHistory={openHistory} />;
}
