// Shared colors / spacing so the four tabs look like one app.
// Two palettes (light + dark); screens get the active one via useTheme().

import { StyleSheet } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Palette {
  background: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  accentLight: string;
  border: string;
  danger: string;
  dangerLight: string;
  input: string;
}

export const lightPalette: Palette = {
  background: '#FAFAF7',
  card: '#FFFFFF',
  text: '#1F2937',
  muted: '#6B7280',
  accent: '#2E7D32', // deep green — health / whole-food vibe
  accentLight: '#E8F5E9',
  border: '#E5E7EB',
  danger: '#C62828',
  dangerLight: '#FDECEA',
  input: '#FFFFFF',
};

export const darkPalette: Palette = {
  background: '#121615',
  card: '#1C2220',
  text: '#E9EDEB',
  muted: '#9BA6A1',
  accent: '#4CAF50', // brighter green so it reads on dark backgrounds
  accentLight: '#1C2E1F',
  border: '#2C3431',
  danger: '#E57373',
  dangerLight: '#332020',
  input: '#1C2220',
};

export const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

/** The shared stylesheet, built from whichever palette is active. */
export function makeCommon(C: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      padding: 16,
      paddingBottom: 32,
    },
    card: {
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
      ...SHADOW,
    },
    h1: {
      fontSize: 24,
      fontWeight: '700',
      color: C.text,
      marginBottom: 4,
    },
    h2: {
      fontSize: 17,
      fontWeight: '600',
      color: C.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: C.muted,
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: C.muted,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      backgroundColor: C.input,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: C.text,
    },
    primaryButton: {
      backgroundColor: C.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: C.accentLight,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryButtonText: {
      color: C.accent,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
