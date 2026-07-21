import {
  Bell,
  Bolt,
  Check,
  Download,
  Globe,
  History,
  House,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Lock,
  Palette,
  Pause,
  Play,
  Search,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';

import { type ThemeColor } from './tokens';
import { useTheme } from './theme';

const icons = {
  bolt: Bolt,
  bell: Bell,
  check: Check,
  image: ImageIcon,
  link: LinkIcon,
  lock: Lock,
  globe: Globe,
  palette: Palette,
  pause: Pause,
  play: Play,
  sparkle: Sparkles,
  close: X,
  download: Download,
  history: History,
  home: House,
  info: Info,
  settings: Settings,
  search: Search,
  share: Share2,
  trash: Trash2,
  warning: TriangleAlert,
} as const satisfies Record<string, LucideIcon>;

export const iconStrokeWidth = 1.8;

export type IconName = keyof typeof icons;

export type IconProps = Omit<LucideProps, 'color'> & {
  color?: ThemeColor;
  name: IconName;
};

export function Icon({ color = 'text', name, size = 24, ...props }: IconProps) {
  const { colors } = useTheme();
  const LucideIconComponent = icons[name];

  return (
    <LucideIconComponent
      {...props}
      accessibilityElementsHidden
      color={colors[color]}
      importantForAccessibility="no-hide-descendants"
      size={size}
      strokeWidth={iconStrokeWidth}
    />
  );
}
