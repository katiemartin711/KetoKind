import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  onDownload: () => void;
  onImport: () => void;
}

/** Download / import the full-device backup file. */
export default function BackupSection({ onDownload, onImport }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>Data backup</Text>
      <Text style={styles.hint}>
        Download a backup file with all your data, or restore from one — handy when
        switching phones. Save the file somewhere safe; anyone with it can read your logs.
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
  });
