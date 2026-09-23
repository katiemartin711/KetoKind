import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  onDownload: () => void;
  onImport: () => void;
  /** Free users see a "Pro feature" note; taps open the paywall instead. */
  locked?: boolean;
}

/** Download / import the full-device backup file. A KetoKind Pro feature. */
export default function BackupSection({ onDownload, onImport, locked = false }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <View style={styles.titleRow}>
        <Text style={common.h2}>Data backup</Text>
        {locked && <Text style={styles.proBadge}>PRO</Text>}
      </View>
      <Text style={styles.hint}>
        Download a backup file with all your logs and profile settings, or restore from one —
        handy when switching phones. Pro purchase status is not included (restore purchases
        through the App Store or Play Store). Save the file somewhere safe; it contains health
        data anyone with the file can read.
      </Text>
      <TouchableOpacity style={common.secondaryButton} onPress={onDownload}>
        <Text style={common.secondaryButtonText}>Download all data</Text>
      </TouchableOpacity>
      <TouchableOpacity style={common.secondaryButton} onPress={onImport}>
        <Text style={common.secondaryButtonText}>Import data</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginBottom: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    proBadge: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: C.accent,
      borderWidth: 1,
      borderColor: C.accent,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
    },
  });
