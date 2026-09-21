import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimeField from './DateTimeField';
import QtyRow from './QtyRow';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { Medication, Supplement } from '../../types';

interface Props {
  medications: Medication[];
  profileSupps: Supplement[];
  selectedMedIds: number[];
  selectedSuppIds: number[];
  medQty: Record<number, number>;
  suppQty: Record<number, number>;
  onToggleMed: (id: number) => void;
  onToggleSupp: (id: number) => void;
  onBumpQty: (kind: 'med' | 'supp', id: number, delta: number) => void;
  logDate: Date;
  onLogDateChange: (d: Date) => void;
  /** Non-null while editing a single existing entry (locks the other section). */
  editingKind: 'medication' | 'supplement' | null;
  onSave: () => void;
  onCancel: () => void;
}

/** Tap-to-log for medications & supplements: chips, shared timestamp,
 *  and "how many" steppers for selected as-needed items. */
export default function MedSuppForm(props: Props) {
  const {
    medications,
    profileSupps,
    selectedMedIds,
    selectedSuppIds,
    medQty,
    suppQty,
    onToggleMed,
    onToggleSupp,
    onBumpQty,
    logDate,
    onLogDateChange,
    editingKind,
    onSave,
    onCancel,
  } = props;
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const medSuppSelected = selectedMedIds.length + selectedSuppIds.length > 0;
  // Selected as-needed items get a "how many" stepper below the chips.
  const asNeededMedSel = medications.filter((m) => m.as_needed && selectedMedIds.includes(m.id));
  const asNeededSuppSel = profileSupps.filter((s) => s.as_needed && selectedSuppIds.includes(s.id));

  return (
    <View style={common.card}>
      <Text style={common.label}>Medications — tap all you took</Text>
      {medications.length === 0 ? (
        <Text style={styles.hint}>No medications yet — add them on the Profile tab first.</Text>
      ) : (
        <View style={styles.chips}>
          {medications.map((m) => {
            const selected = selectedMedIds.includes(m.id);
            const locked = editingKind === 'supplement';
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, selected && styles.chipActive, locked && styles.chipLocked]}
                onPress={() => onToggleMed(m.id)}
                disabled={locked}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {m.name}
                  {m.dosage ? ` (${m.dosage})` : ''}
                  {m.as_needed ? ' · as needed' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Text style={[common.label, { marginTop: 12 }]}>Supplements — tap all you took</Text>
      {profileSupps.length === 0 ? (
        <Text style={styles.hint}>No supplements yet — add them on the Profile tab first.</Text>
      ) : (
        <View style={styles.chips}>
          {profileSupps.map((s) => {
            const selected = selectedSuppIds.includes(s.id);
            const locked = editingKind === 'medication';
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, selected && styles.chipActive, locked && styles.chipLocked]}
                onPress={() => onToggleSupp(s.id)}
                disabled={locked}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {s.name}
                  {s.dosage ? ` (${s.dosage})` : ''}
                  {s.as_needed ? ' · as needed' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <DateTimeField value={logDate} onChange={onLogDateChange} />
      {(asNeededMedSel.length > 0 || asNeededSuppSel.length > 0) && (
        <>
          <Text style={[common.label, { marginTop: 4 }]}>How many?</Text>
          {asNeededMedSel.map((m) => (
            <QtyRow
              key={`m${m.id}`}
              name={m.name}
              qty={medQty[m.id] ?? 1}
              onDec={() => onBumpQty('med', m.id, -1)}
              onInc={() => onBumpQty('med', m.id, 1)}
            />
          ))}
          {asNeededSuppSel.map((s) => (
            <QtyRow
              key={`s${s.id}`}
              name={s.name}
              qty={suppQty[s.id] ?? 1}
              onDec={() => onBumpQty('supp', s.id, -1)}
              onInc={() => onBumpQty('supp', s.id, 1)}
            />
          ))}
        </>
      )}
      <TouchableOpacity
        style={[common.primaryButton, !medSuppSelected && styles.disabled]}
        onPress={onSave}
        disabled={!medSuppSelected}
      >
        <Text style={common.primaryButtonText}>
          {editingKind ? 'Save changes' : 'Mark selected as taken'}
        </Text>
      </TouchableOpacity>
      {editingKind && (
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
    chipLocked: { opacity: 0.4 },
    chipText: { fontSize: 14, color: C.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    hint: { fontSize: 14, color: C.muted, marginVertical: 8 },
    disabled: { opacity: 0.5 },
  });
