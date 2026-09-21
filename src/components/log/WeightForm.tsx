import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimeField from './DateTimeField';
import { useTheme } from '../../ThemeContext';

interface Props {
  weightInput: string;
  onWeightInputChange: (s: string) => void;
  logDate: Date;
  onLogDateChange: (d: Date) => void;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function WeightForm({
  weightInput,
  onWeightInputChange,
  logDate,
  onLogDateChange,
  editing,
  onSave,
  onCancel,
}: Props) {
  const { common } = useTheme();

  return (
    <View style={common.card}>
      <Text style={common.label}>Weight (lbs)</Text>
      <TextInput
        style={common.input}
        keyboardType="decimal-pad"
        placeholder="e.g. 182.5"
        value={weightInput}
        onChangeText={onWeightInputChange}
        maxLength={7}
        accessibilityLabel="Weight in pounds"
      />
      <DateTimeField value={logDate} onChange={onLogDateChange} />
      <TouchableOpacity style={common.primaryButton} onPress={onSave}>
        <Text style={common.primaryButtonText}>
          {editing ? 'Save changes' : 'Save weight'}
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
