import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

/** One deletable (optionally tappable-to-edit) row in a profile list. */
export default function ListRow({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      {onEdit ? (
        <TouchableOpacity
          style={styles.rowLabelWrap}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
        >
          <Text style={styles.rowLabel}>{label}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.rowLabel}>{label}</Text>
      )}
      <TouchableOpacity
        onPress={onDelete}
        style={styles.rowDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${label}`}
      >
        <Text style={styles.rowDeleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    rowLabel: { flex: 1, fontSize: 15, color: C.text },
    rowLabelWrap: { flex: 1 },
    rowDelete: {
      backgroundColor: C.dangerLight,
      borderRadius: 22,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowDeleteText: { color: C.danger, fontWeight: '700' },
  });
