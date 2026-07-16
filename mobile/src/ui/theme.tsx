import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  darkTheme,
  lightTheme,
  type ThemeColors,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

type ResolvedTheme = {
  mode: Exclude<ThemeMode, 'system'>;
  colors: ThemeColors;
};

const ThemeContext = createContext<ResolvedTheme | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
  mode?: ThemeMode;
};

export function AppThemeProvider({
  children,
  mode = 'system',
}: AppThemeProviderProps) {
  const systemMode = useColorScheme();
  const resolvedMode = mode === 'system'
    ? systemMode === 'dark' ? 'dark' : 'light'
    : mode;
  const value = useMemo<ResolvedTheme>(
    () => ({
      mode: resolvedMode,
      colors: resolvedMode === 'dark' ? darkTheme : lightTheme,
    }),
    [resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }

  return theme;
}
