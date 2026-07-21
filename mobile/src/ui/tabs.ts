import type { IconName } from './icon';

export const tabItems = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'downloads', label: 'Downloads', icon: 'download' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
] as const satisfies readonly { name: string; label: string; icon: IconName }[];
