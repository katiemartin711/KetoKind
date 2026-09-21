import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimeField from './DateTimeField';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface Props {
  mealName: string;
  onMealNameChange: (s: string) => void;
  mealType: string;
  onMealTypeChange: (s: string) => void;
  mealNotes: string;
  onMealNotesChange: (s: string) => void;
  logDate: Date;
  onLogDateChange: (d: Date) => void;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function MealForm(props: Props) {
  const {
    mealName,
    onMealNameChange,
    mealType,
    onMealTypeChange,
    mealNotes,
    onMealNotesChange,
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
      <Text style={common.label}>What did you eat?</Text>
      <TextInput
        style={common.input}
        placeholder="e.g. Ribeye steak, 3 eggs"
        value={mealName}
        onChangeText={onMealNameChange}
        maxLength={120}
      />
      <Text style={common.label}>Meal</Text>
      <View style={styles.chips}>
        {MEAL_TYPES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, mealType === m && styles.chipActive]}
            onPress={() => onMealTypeChange(m)}
          >
            <Text style={[styles.chipText, mealType === m && styles.chipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={common.label}>Notes (optional)</Text>
      <TextInput
        style={common.input}
        placeholder="How was it?"
        value={mealNotes}
        onChangeText={onMealNotesChange}
        maxLength={200}
      />
      <DateTimeField value={logDate} onChange={onLogDateChange} />
      <TouchableOpacity style={common.primaryButton} onPress={onSave}>
        <Text style={common.primaryButtonText}>{editing ? 'Save changes' : 'Save meal'}</Text>
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
