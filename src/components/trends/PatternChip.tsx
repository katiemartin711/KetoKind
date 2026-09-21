import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  selected: boolean;
  label: string;
  onPress: () => void;
  a11yLabel: string;
}

/** Selectable pill used for the symptom / medication-supplement pickers. */
export default function PatternChip({ selected, label, onPress, a11yLabel }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: C.input,
      marginBottom: 4,
    },
    chipActive: { backgroundColor: C.accent, borderColor: C.accent },
    chipText: { fontSize: 14, color: C.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
  });
