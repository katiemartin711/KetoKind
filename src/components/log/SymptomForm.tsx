import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimeField from './DateTimeField';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  symptomName: string;
  onSymptomNameChange: (s: string) => void;
  severity: number;
  onSeverityChange: (n: number) => void;
  symptomNotes: string;
  onSymptomNotesChange: (s: string) => void;
  logDate: Date;
  onLogDateChange: (d: Date) => void;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function SymptomForm(props: Props) {
  const {
    symptomName,
    onSymptomNameChange,
    severity,
    onSeverityChange,
    symptomNotes,
    onSymptomNotesChange,
    logDate,
    onLogDateChange,
    editing,
    onSave,
    onCancel,
  } = props;
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.label}>Symptom</Text>
      <TextInput
        style={common.input}
        placeholder="e.g. Bloating, headache, low energy"
        value={symptomName}
        onChangeText={onSymptomNameChange}
        maxLength={80}
      />
      <Text style={common.label}>Severity: {severity}/5</Text>
      <View style={styles.chips}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, severity === n && styles.chipActive]}
            onPress={() => onSeverityChange(n)}
          >
            <Text style={[styles.chipText, severity === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={common.label}>Notes (optional)</Text>
      <TextInput
        style={common.input}
        placeholder="Anything notable?"
        value={symptomNotes}
        onChangeText={onSymptomNotesChange}
        maxLength={200}
      />
      <DateTimeField value={logDate} onChange={onLogDateChange} />
      <TouchableOpacity style={common.primaryButton} onPress={onSave}>
        <Text style={common.primaryButtonText}>
          {editing ? 'Save changes' : 'Save symptom'}
        </Text>
      </TouchableOpacity>
      {editing && (
        <TouchableOpacity style={common.secondaryButton} onPress={onCancel}>
          <Text style={common.secondaryButtonText}>Cancel editing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: C.card,
    },
    chipActive: { backgroundColor: C.accent, borderColor: C.accent },
    chipText: { fontSize: 14, color: C.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
  });
