import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  trackWeight: boolean;
  onTrackWeightChange: (v: boolean) => void;
  startingWeight: string;
  onStartingWeightChange: (s: string) => void;
  savedFlash: boolean;
  onSave: () => void;
}

/** Optional weight-tracking preference + starting weight. */
export default function WeightSection({
  trackWeight,
  onTrackWeightChange,
  startingWeight,
  onStartingWeightChange,
  savedFlash,
  onSave,
}: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>Weight tracking</Text>
      <Text style={styles.hint}>Optional — turn this on if you want to log your weight.</Text>
      <TouchableOpacity
        style={styles.asNeededRow}
        onPress={() => onTrackWeightChange(!trackWeight)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: trackWeight }}
        accessibilityLabel="Track my weight"
      >
        <View style={[styles.checkbox, trackWeight && styles.checkboxActive]}>
          {trackWeight && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.asNeededLabel}>Track my weight</Text>
      </TouchableOpacity>
      {trackWeight && (
        <>
          <Text style={common.label}>Starting weight (lbs)</Text>
          <TextInput
            style={common.input}
            keyboardType="decimal-pad"
            placeholder="e.g. 185"
            value={startingWeight}
            onChangeText={onStartingWeightChange}
            maxLength={7}
          />
        </>
      )}
      <TouchableOpacity style={common.secondaryButton} onPress={onSave}>
        <Text style={common.secondaryButtonText}>
          {savedFlash ? 'Saved ✓' : 'Save weight settings'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginBottom: 4 },
    asNeededRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
    checkmark: { color: '#fff', fontWeight: '700', fontSize: 15 },
    asNeededLabel: { fontSize: 15, color: C.text },
  });
