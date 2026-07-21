import type { IconName } from './icon';
import { motion } from './tokens';

export const tabItems = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'downloads', label: 'Downloads', icon: 'download' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
] as const satisfies readonly { name: string; label: string; icon: IconName }[];

export function getTabMotion(disabled: boolean) {
  return {
    animation: disabled ? 'none' as const : 'shift' as const,
    transitionSpec: {
      animation: 'timing' as const,
      config: { duration: disabled ? 0 : motion.standard.stateDuration },
    },
  };
}
