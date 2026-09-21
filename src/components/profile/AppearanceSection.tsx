import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette, ThemeMode } from '../../theme';

/** Light / dark / system theme picker. Reads theme state directly. */
export default function AppearanceSection() {
  const { colors, common, mode: themeMode, setMode: setAppTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>Appearance</Text>
      {(
        [
          { key: 'system', label: 'System default', hint: "Follows your phone's light / dark setting" },
          { key: 'light', label: 'Light' },
          { key: 'dark', label: 'Dark' },
        ] as { key: ThemeMode; label: string; hint?: string }[]
      ).map((o) => (
        <TouchableOpacity
          key={o.key}
          style={styles.radioRow}
          onPress={() => setAppTheme(o.key)}
          accessibilityRole="radio"
          accessibilityState={{ selected: themeMode === o.key }}
          accessibilityLabel={o.label}
        >
          <View style={[styles.radio, themeMode === o.key && styles.radioActive]}>
            {themeMode === o.key && <View style={styles.radioDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.radioLabel}>{o.label}</Text>
            {o.hint ? <Text style={styles.radioHint}>{o.hint}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: C.accent },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent },
    radioLabel: { fontSize: 16, color: C.text, marginLeft: 10 },
    radioHint: { fontSize: 13, color: C.muted, marginLeft: 10, marginTop: 2 },
  });
