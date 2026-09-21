import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  onDelete: () => void;
}

/** Nuclear option: wipe everything on-device. */
export default function DangerSection({ onDelete }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>Delete all data</Text>
      <Text style={styles.hint}>
        Permanently wipes your profile, logs, medications, supplements, and weight
        history from this device. Useful if you want to start fresh.
      </Text>
      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete all data</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginBottom: 4 },
    deleteButton: {
      backgroundColor: C.danger,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    deleteButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
