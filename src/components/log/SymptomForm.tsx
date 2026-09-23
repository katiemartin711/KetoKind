import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimeField from './DateTimeField';
import { filterSymptomSuggestions } from './symptomSuggestions';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  symptomName: string;
  onSymptomNameChange: (s: string) => void;
  /** Distinct names from past symptom logs (most recent first). */
  priorNames: string[];
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
    priorNames,
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
  const suggestions = useMemo(
    () => filterSymptomSuggestions(priorNames, symptomName),
    [priorNames, symptomName],
  );

  return (
    <View style={common.card}>
      <Text style={common.label}>Symptom</Text>
      <TextInput
        style={common.input}
        placeholder="e.g. Bloating, headache, low energy"
        value={symptomName}
        onChangeText={onSymptomNameChange}
        maxLength={80}
        accessibilityLabel="Symptom"
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestBlock}>
          <Text style={styles.suggestHint}>From your logs</Text>
          <View style={styles.chips}>
            {suggestions.map((name) => (
              <TouchableOpacity
                key={name.toLowerCase()}
                style={styles.suggestChip}
                onPress={() => onSymptomNameChange(name)}
                accessibilityRole="button"
                accessibilityLabel={`Use symptom name ${name}`}
              >
                <Text style={styles.suggestChipText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <Text style={common.label}>Severity: {severity}/5</Text>
      <View style={styles.chips}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, severity === n && styles.chipActive]}
            onPress={() => onSeverityChange(n)}
            accessibilityRole="checkbox"
            accessibilityState={{ selected: severity === n }}
            accessibilityLabel={`Severity ${n} of 5`}
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
        accessibilityLabel="Notes, optional"
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
    suggestBlock: { marginTop: 8 },
    suggestHint: { fontSize: 12, color: C.muted, marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    suggestChip: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: C.accentLight,
    },
    suggestChipText: { fontSize: 13, color: C.text },
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
