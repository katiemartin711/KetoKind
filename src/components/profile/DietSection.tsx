import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { DIET_LABELS, DIET_TYPES } from '../../types';
import type { DietType } from '../../types';
import { dietPrinciples } from '../../dietPrinciples';
import { formatDietStart, dietDurationLabel } from '../../milestones';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

export interface DietStartParts {
  month: string;
  day: string;
  year: string;
}

interface Props {
  dietType: DietType;
  infoDiet: DietType | null;
  onSelectDiet: (d: DietType) => void;
  onToggleInfo: (d: DietType) => void;
  nuances: string;
  onNuancesChange: (s: string) => void;
  goals: string;
  onGoalsChange: (s: string) => void;
  dietStart: DietStartParts;
  onDietStartChange: (part: keyof DietStartParts, value: string) => void;
  savedDietStart: string | null;
  savedDietType: DietType;
  savedFlash: boolean;
  onSave: () => void;
}

/** Diet type picker (with per-diet principle info buttons), nuances, goals,
 *  diet start date, and the "time on diet" callout. */
export default function DietSection(props: Props) {
  const {
    dietType,
    infoDiet,
    onSelectDiet,
    onToggleInfo,
    nuances,
    onNuancesChange,
    goals,
    onGoalsChange,
    dietStart,
    onDietStartChange,
    savedDietStart,
    savedDietType,
    savedFlash,
    onSave,
  } = props;
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>Diet type</Text>
      {DIET_TYPES.map((d) => (
        <React.Fragment key={d}>
          <TouchableOpacity style={styles.radioRow} onPress={() => onSelectDiet(d)}>
            <View style={[styles.radio, dietType === d && styles.radioActive]}>
              {dietType === d && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.radioLabel, styles.dietLabelFlex]}>{DIET_LABELS[d]}</Text>
            <TouchableOpacity
              style={styles.infoButton}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${DIET_LABELS[d]} principles`}
              onPress={() => onToggleInfo(d)}
            >
              <Text style={styles.infoText}>i</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          {infoDiet === d && (
            <View style={styles.principlesBox}>
              {dietPrinciples(d).map((p, i) => (
                <Text key={i} style={styles.principleText}>
                  <Text style={styles.principleNum}>{`${i + 1}. `}</Text>
                  {p}
                </Text>
              ))}
            </View>
          )}
        </React.Fragment>
      ))}

      <Text style={common.label}>Diet nuances — what do you / don't you include?</Text>
      <TextInput
        style={[common.input, styles.multiline]}
        multiline
        numberOfLines={4}
        placeholder="e.g. Carnivore + coffee. No dairy except butter. Eggs daily."
        value={nuances}
        onChangeText={onNuancesChange}
        textAlignVertical="top"
        maxLength={500}
      />

      <Text style={common.label}>Goals</Text>
      <TextInput
        style={[common.input, styles.multiline]}
        multiline
        numberOfLines={3}
        placeholder="e.g. Resolve gut issues, steady energy, lose 15 lbs."
        value={goals}
        onChangeText={onGoalsChange}
        textAlignVertical="top"
        maxLength={300}
      />

      <Text style={common.label}>When did you start your diet?</Text>
      <Text style={styles.hint}>
        Month and year are enough — add the day if you know it. Used for milestone celebrations.
      </Text>
      <View style={styles.threeCol}>
        <View style={styles.col}>
          <Text style={common.label}>Month</Text>
          <TextInput
            style={common.input}
            keyboardType="number-pad"
            placeholder="e.g. 3"
            value={dietStart.month}
            onChangeText={(v) => onDietStartChange('month', v)}
            maxLength={2}
          />
        </View>
        <View style={styles.col}>
          <Text style={common.label}>Day (optional)</Text>
          <TextInput
            style={common.input}
            keyboardType="number-pad"
            placeholder="e.g. 14"
            value={dietStart.day}
            onChangeText={(v) => onDietStartChange('day', v)}
            maxLength={2}
          />
        </View>
        <View style={styles.col}>
          <Text style={common.label}>Year</Text>
          <TextInput
            style={common.input}
            keyboardType="number-pad"
            placeholder="e.g. 2024"
            value={dietStart.year}
            onChangeText={(v) => onDietStartChange('year', v)}
            maxLength={4}
          />
        </View>
      </View>

      {savedDietStart ? (
        <View style={styles.dietCallout}>
          <Text style={styles.dietCalloutText}>
            🎉 {dietDurationLabel(savedDietStart)} on {DIET_LABELS[savedDietType]} — since{' '}
            {formatDietStart(savedDietStart)}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity style={common.primaryButton} onPress={onSave}>
        <Text style={common.primaryButtonText}>{savedFlash ? 'Saved ✓' : 'Save profile'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: C.accent },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent },
    radioLabel: { fontSize: 16, color: C.text, marginLeft: 10 },
    dietLabelFlex: { flex: 1 },
    infoButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoText: { fontSize: 13, fontWeight: '700', color: C.muted },
    principlesBox: {
      backgroundColor: C.accentLight,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    principleText: { fontSize: 13, color: C.text, lineHeight: 19, marginBottom: 6 },
    principleNum: { fontWeight: '700', color: C.accent },
    multiline: { minHeight: 90 },
    hint: { fontSize: 14, color: C.muted, marginBottom: 4 },
    threeCol: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    dietCallout: {
      backgroundColor: C.accentLight,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 12,
    },
    dietCalloutText: { fontSize: 14, color: C.text, fontWeight: '600' },
  });
