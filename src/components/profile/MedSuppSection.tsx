import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import ListRow from './ListRow';
import { SHADOW } from '../../theme';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { Medication, Supplement } from '../../types';

export type MedSuppTab = 'medication' | 'supplement';

export interface MedSuppFormState {
  name: string;
  dosage: string;
  times: string;
  purpose: string;
  asNeeded: boolean;
}

/** Non-null while an existing medication/supplement is loaded into the form. */
export interface EditingEntry {
  tab: MedSuppTab;
  id: number;
}

export interface SchedulableEntry {
  id: number;
  name: string;
  dosage: string;
  times_per_day: number;
  purpose: string;
  as_needed: number;
}

interface Props {
  tab: MedSuppTab;
  onTabChange: (t: MedSuppTab) => void;
  medications: Medication[];
  supplements: Supplement[];
  editingEntry: EditingEntry | null;
  form: MedSuppFormState;
  onFormChange: (patch: Partial<MedSuppFormState>) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onStartEdit: (tab: MedSuppTab, entry: SchedulableEntry) => void;
  onDeleteMedication: (id: number) => void;
  onDeleteSupplement: (id: number) => void;
}

const medSuppLabel = (m: SchedulableEntry): string =>
  `${m.name}${m.dosage ? ` — ${m.dosage}` : ''} (${m.as_needed ? 'as needed' : `${m.times_per_day}x/day`})${m.purpose ? ` · for ${m.purpose}` : ''}`;

/** Medications & supplements manager: tabbed list, add/edit form. */
export default function MedSuppSection(props: Props) {
  const {
    tab,
    onTabChange,
    medications,
    supplements,
    editingEntry,
    form,
    onFormChange,
    onSave,
    onCancelEdit,
    onStartEdit,
    onDeleteMedication,
    onDeleteSupplement,
  } = props;
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isMed = tab === 'medication';

  return (
    <View style={common.card}>
      <Text style={common.h2}>Medications & supplements</Text>
      <View style={styles.toggleRow}>
        {(['medication', 'supplement'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.toggleBtn, tab === t && styles.toggleBtnActive]}
            onPress={() => onTabChange(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            accessibilityLabel={t === 'medication' ? 'Medications' : 'Supplements'}
          >
            <Text style={[styles.toggleText, tab === t && styles.toggleTextActive]}>
              {t === 'medication' ? 'Medications' : 'Supplements'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {isMed
        ? medications.map((m) => (
            <ListRow
              key={m.id}
              label={medSuppLabel(m)}
              onEdit={() => onStartEdit('medication', m)}
              onDelete={() => onDeleteMedication(m.id)}
            />
          ))
        : supplements.map((s) => (
            <ListRow
              key={s.id}
              label={medSuppLabel(s)}
              onEdit={() => onStartEdit('supplement', s)}
              onDelete={() => onDeleteSupplement(s.id)}
            />
          ))}
      <Text style={common.label}>Name</Text>
      <TextInput
        style={common.input}
        placeholder={isMed ? 'e.g. Metformin' : 'e.g. Vitamin D3'}
        value={form.name}
        onChangeText={(v) => onFormChange({ name: v })}
        maxLength={80}
      />
      <Text style={common.label}>What it's for</Text>
      <TextInput
        style={common.input}
        placeholder={isMed ? 'e.g. blood sugar' : 'e.g. immune support'}
        value={form.purpose}
        onChangeText={(v) => onFormChange({ purpose: v })}
        maxLength={120}
      />
      <View style={styles.medRow}>
        <View style={styles.medHalf}>
          <Text style={common.label}>Dosage</Text>
          <TextInput
            style={common.input}
            placeholder={isMed ? 'e.g. 500 mg' : 'e.g. 5000 IU'}
            value={form.dosage}
            onChangeText={(v) => onFormChange({ dosage: v })}
            maxLength={40}
          />
        </View>
        <View style={styles.medHalf}>
          <Text style={common.label}>Times / day</Text>
          <TextInput
            style={[common.input, form.asNeeded && styles.disabledInput]}
            keyboardType="number-pad"
            value={form.times}
            onChangeText={(v) => onFormChange({ times: v })}
            editable={!form.asNeeded}
            maxLength={2}
          />
        </View>
      </View>
      <TouchableOpacity
        style={styles.asNeededRow}
        onPress={() => onFormChange({ asNeeded: !form.asNeeded })}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.asNeeded }}
        accessibilityLabel="As needed (not on a daily schedule)"
      >
        <View style={[styles.checkbox, form.asNeeded && styles.checkboxActive]}>
          {form.asNeeded && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.asNeededLabel}>As needed (not on a daily schedule)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={common.secondaryButton} onPress={onSave}>
        <Text style={common.secondaryButtonText}>
          {editingEntry ? 'Save changes' : isMed ? 'Add medication' : 'Add supplement'}
        </Text>
      </TouchableOpacity>
      {editingEntry && (
        <TouchableOpacity
          style={[common.secondaryButton, { marginTop: 8 }]}
          onPress={onCancelEdit}
        >
          <Text style={common.secondaryButtonText}>Cancel editing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
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
    medRow: { flexDirection: 'row', gap: 12 },
    medHalf: { flex: 1 },
    disabledInput: { opacity: 0.4 },
    asNeededRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
    checkmark: { color: '#fff', fontWeight: '700', fontSize: 15 },
    asNeededLabel: { fontSize: 15, color: C.text },
  });
