import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { AnyLog } from '../../types';

const KIND_LABEL: Record<AnyLog['kind'], string> = {
  meal: 'Meal',
  medication: 'Medication',
  supplement: 'Supplement',
  symptom: 'Symptom',
  weight: 'Weight',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface Props {
  logs: AnyLog[];
  onEdit: (log: AnyLog) => void;
  onDelete: (log: AnyLog) => void;
}

/** Everything logged today, across all types. Tap an entry to edit it. */
export default function TodayEntries({ logs, onEdit, onDelete }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <Text style={[common.h2, { marginTop: 12 }]}>Today's entries</Text>
      {logs.length === 0 ? (
        <Text style={styles.hint}>Nothing logged yet today.</Text>
      ) : (
        <Text style={styles.hint}>Tap an entry to edit it.</Text>
      )}
      {logs.map((log) => (
        <View key={`${log.kind}-${log.id}`} style={[common.card, styles.entryRow]}>
          <TouchableOpacity style={styles.entryText} onPress={() => onEdit(log)}>
            <Text style={styles.entryTitle}>
              {log.title} <Text style={styles.entryKind}>· {KIND_LABEL[log.kind]}</Text>
            </Text>
            <Text style={styles.entryDetail}>
              {fmtTime(log.logged_at)}
              {log.detail ? ` — ${log.detail}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(log)}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${KIND_LABEL[log.kind]} entry`}
          >
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginVertical: 8 },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    entryText: { flex: 1 },
    entryTitle: { fontSize: 15, fontWeight: '600', color: C.text },
    entryKind: { fontWeight: '400', color: C.muted, fontSize: 13 },
    entryDetail: { fontSize: 13, color: C.muted, marginTop: 2 },
    deleteBtn: {
      backgroundColor: C.dangerLight,
      borderRadius: 22,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: { color: C.danger, fontSize: 14, fontWeight: '700' },
  });
