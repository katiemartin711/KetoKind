import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

/** Stepper row for "how many did you take" on an as-needed item. */
export default function QtyRow({
  name,
  qty,
  onDec,
  onInc,
}: {
  name: string;
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.qtyRow}>
      <Text style={styles.qtyName}>{name}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onDec}
          accessibilityRole="button"
          accessibilityLabel={`Take one fewer ${name}`}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{qty}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onInc}
          accessibilityRole="button"
          accessibilityLabel={`Take one more ${name}`}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    qtyName: { flex: 1, fontSize: 15, color: C.text },
    stepper: { flexDirection: 'row', alignItems: 'center' },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { fontSize: 20, color: C.accent, fontWeight: '700' },
    qtyValue: { fontSize: 17, fontWeight: '600', minWidth: 34, textAlign: 'center', color: C.text },
  });
