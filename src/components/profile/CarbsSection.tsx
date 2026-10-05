import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { CarbsMode } from '../../macros';

interface Props {
  mode: CarbsMode;
  onChange: (mode: CarbsMode) => void;
}

/** Net vs. total carbs: which number meal rows show and Trends compares. */
export default function CarbsSection({ mode, onChange }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>Carbs</Text>
      <Text style={styles.hint}>
        Meals always store total carbs and fiber. Pick which number shows on your log and feeds Trends.
      </Text>
      {(
        [
          { key: 'net', label: 'Net carbs', hint: 'Total carbs minus fiber' },
          { key: 'total', label: 'Total carbs', hint: 'Fiber included' },
        ] as { key: CarbsMode; label: string; hint: string }[]
      ).map((o) => (
        <TouchableOpacity
          key={o.key}
          style={styles.radioRow}
          onPress={() => onChange(o.key)}
          accessibilityRole="radio"
          accessibilityState={{ selected: mode === o.key }}
          accessibilityLabel={o.label}
        >
          <View style={[styles.radio, mode === o.key && styles.radioActive]}>
            {mode === o.key && <View style={styles.radioDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.radioLabel}>{o.label}</Text>
            <Text style={styles.radioHint}>{o.hint}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 20 },
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
