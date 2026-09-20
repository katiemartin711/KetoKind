// App-wide theme: light / dark / system (follows the phone).
// The choice persists in the profile table; 'system' is the default.

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkPalette,
  lightPalette,
  makeCommon,
  type Palette,
  type ThemeMode,
} from './theme';
import { getThemeMode, setThemeMode } from './db';

interface ThemeCtx {
  colors: Palette;
  common: ReturnType<typeof makeCommon>;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // initDb() already ran at app startup (module level in App.tsx),
  // so the persisted choice is safe to read during first render.
  const [mode, setModeState] = useState<ThemeMode>(() => getThemeMode());
  const systemScheme = useColorScheme();

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkPalette : lightPalette;
  const common = useMemo(() => makeCommon(colors), [colors]);

  const setMode = useCallback((m: ThemeMode) => {
    setThemeMode(m);
    setModeState(m);
  }, []);

  const value = useMemo(
    () => ({ colors, common, mode, isDark, setMode }),
    [colors, common, mode, isDark, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
