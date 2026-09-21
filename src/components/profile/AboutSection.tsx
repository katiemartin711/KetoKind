import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SHADOW } from '../../theme';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

export type SexOption = 'female' | 'male' | '';

interface Props {
  age: string;
  onAgeChange: (s: string) => void;
  sex: SexOption;
  onSexChange: (s: SexOption) => void;
  bio: string;
  onBioChange: (s: string) => void;
}

/** Age, sex, and free-text bio — context for the AI coach. */
export default function AboutSection({ age, onAgeChange, sex, onSexChange, bio, onBioChange }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>About you</Text>
      <Text style={styles.hint}>Helps your AI coach give age-appropriate guidance.</Text>
      <Text style={common.label}>Age</Text>
      <TextInput
        style={common.input}
        keyboardType="number-pad"
        placeholder="e.g. 32"
        value={age}
        onChangeText={onAgeChange}
        maxLength={3}
      />
      <Text style={common.label}>Sex</Text>
      <View style={styles.toggleRow}>
        {(
          [
            { key: 'female', label: 'Female' },
            { key: 'male', label: 'Male' },
          ] as const
        ).map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.toggleBtn, sex === o.key && styles.toggleBtnActive]}
            onPress={() => onSexChange(sex === o.key ? '' : o.key)}
          >
            <Text style={[styles.toggleText, sex === o.key && styles.toggleTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={common.label}>Bio — anything else the coach should know</Text>
      <TextInput
        style={[common.input, styles.multiline]}
        multiline
        numberOfLines={4}
        placeholder="e.g. New to keto. Lift weights 3x/week. Pregnant. Sleep poorly since switching shifts."
        value={bio}
        onChangeText={onBioChange}
        textAlignVertical="top"
        maxLength={500}
      />
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginBottom: 4 },
    multiline: { minHeight: 90 },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: C.border,
      borderRadius: 12,
      padding: 4,
      marginBottom: 4,
    },
    toggleBtn: { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
    toggleBtnActive: { backgroundColor: C.card, ...SHADOW },
    toggleText: { fontSize: 15, fontWeight: '600', color: C.muted },
    toggleTextActive: { color: C.accent },
  });
