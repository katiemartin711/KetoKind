// Profile tab: diet type, personal diet nuances, goals, and editable lists
// for allergies, health conditions, and medications. Everything here feeds
// the AI context file generated on the AI Coach tab.

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  addAllergy,
  addCondition,
  addMedication,
  addSupplement,
  deleteAllergy,
  deleteCondition,
  deleteMedication,
  deleteSupplement,
  getProfile,
  listAllergies,
  listConditions,
  listMedications,
  listSupplements,
  saveProfile,
  setWeightTracking,
  updateMedication,
  updateSupplement,
} from '../db';
import type { Allergy, Condition, DietType, Medication, Supplement } from '../types';
import { DIET_LABELS, DIET_TYPES } from '../types';
import { COLORS, SHADOW, common } from '../theme';
import KeyboardScrollView from '../components/KeyboardScrollView';

export default function ProfileScreen() {
  const [dietType, setDietType] = useState<DietType>('carnivore');
  const [nuances, setNuances] = useState('');
  const [goals, setGoals] = useState('');
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [medSuppTab, setMedSuppTab] = useState<'medication' | 'supplement'>('medication');
  const [savedFlash, setSavedFlash] = useState(false);

  // Add-row inputs
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medTimes, setMedTimes] = useState('1');
  const [medPurpose, setMedPurpose] = useState('');
  const [medAsNeeded, setMedAsNeeded] = useState(false);
  const [trackWeight, setTrackWeight] = useState(false);
  const [startingWeight, setStartingWeight] = useState('');
  const [weightSavedFlash, setWeightSavedFlash] = useState(false);
  // Non-null while an existing medication/supplement is loaded into the form.
  const [editingEntry, setEditingEntry] = useState<{
    tab: 'medication' | 'supplement';
    id: number;
  } | null>(null);

  const refresh = useCallback(() => {
    const p = getProfile();
    setDietType(p.diet_type);
    setNuances(p.diet_nuances);
    setGoals(p.goals);
    setAllergies(listAllergies());
    setConditions(listConditions());
    setMedications(listMedications());
    setSupplements(listSupplements());
    setTrackWeight(!!p.track_weight);
    setStartingWeight(p.starting_weight != null ? String(p.starting_weight) : '');
  }, []);

  useFocusEffect(refresh);

  const onSave = () => {
    saveProfile(dietType, nuances, goals);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const saveWeightSettings = () => {
    let sw: number | null = null;
    if (trackWeight && startingWeight.trim() !== '') {
      const n = parseFloat(startingWeight);
      if (isNaN(n) || n <= 0) {
        return Alert.alert('Invalid', 'Starting weight must be a positive number.');
      }
      sw = n;
    }
    setWeightTracking(trackWeight, sw);
    setWeightSavedFlash(true);
    setTimeout(() => setWeightSavedFlash(false), 2000);
  };

  const addAllergyRow = () => {
    if (!allergyInput.trim()) return;
    addAllergy(allergyInput);
    setAllergyInput('');
    setAllergies(listAllergies());
  };

  const addConditionRow = () => {
    if (!conditionInput.trim()) return;
    addCondition(conditionInput);
    setConditionInput('');
    setConditions(listConditions());
  };

  const clearMedSuppForm = () => {
    setMedName('');
    setMedDosage('');
    setMedTimes('1');
    setMedPurpose('');
    setMedAsNeeded(false);
    setEditingEntry(null);
  };

  const startEditMedSupp = (
    tab: 'medication' | 'supplement',
    m: { id: number; name: string; dosage: string; times_per_day: number; purpose: string; as_needed: number },
  ) => {
    setMedSuppTab(tab);
    setMedName(m.name);
    setMedDosage(m.dosage);
    setMedTimes(String(m.times_per_day));
    setMedPurpose(m.purpose);
    setMedAsNeeded(!!m.as_needed);
    setEditingEntry({ tab, id: m.id });
  };

  const saveMedSuppRow = () => {
    const isMed = medSuppTab === 'medication';
    const kind = isMed ? 'medication' : 'supplement';
    if (!medName.trim()) return Alert.alert('Missing name', `Give the ${kind} a name.`);
    const times = parseInt(medTimes, 10);
    if (!medAsNeeded && (isNaN(times) || times < 1)) {
      return Alert.alert('Invalid', 'Times per day must be at least 1.');
    }
    if (editingEntry) {
      if (editingEntry.tab === 'medication') {
        updateMedication(editingEntry.id, medName, medDosage, times, medPurpose, medAsNeeded);
        setMedications(listMedications());
      } else {
        updateSupplement(editingEntry.id, medName, medDosage, times, medPurpose, medAsNeeded);
        setSupplements(listSupplements());
      }
    } else if (isMed) {
      addMedication(medName, medDosage, times, medPurpose, medAsNeeded);
      setMedications(listMedications());
    } else {
      addSupplement(medName, medDosage, times, medPurpose, medAsNeeded);
      setSupplements(listSupplements());
    }
    clearMedSuppForm();
  };

  const medSuppLabel = (m: {
    name: string;
    dosage: string;
    times_per_day: number;
    purpose: string;
    as_needed: number;
  }) =>
    `${m.name}${m.dosage ? ` — ${m.dosage}` : ''} (${m.as_needed ? 'as needed' : `${m.times_per_day}x/day`})${m.purpose ? ` · for ${m.purpose}` : ''}`;

  return (
    <KeyboardScrollView>
      <Text style={common.h1}>Profile</Text>
      <Text style={common.subtitle}>
        This is what gets included in your AI coach context file.
      </Text>

        <View style={common.card}>
          <Text style={common.h2}>Diet type</Text>
          {DIET_TYPES.map((d) => (
            <TouchableOpacity key={d} style={styles.radioRow} onPress={() => setDietType(d)}>
              <View style={[styles.radio, dietType === d && styles.radioActive]}>
                {dietType === d && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioLabel}>{DIET_LABELS[d]}</Text>
            </TouchableOpacity>
          ))}

          <Text style={common.label}>Diet nuances — what do you / don't you include?</Text>
          <TextInput
            style={[common.input, styles.multiline]}
            multiline
            numberOfLines={4}
            placeholder="e.g. Carnivore + coffee. No dairy except butter. Eggs daily."
            value={nuances}
            onChangeText={setNuances}
            textAlignVertical="top"
          />

          <Text style={common.label}>Goals</Text>
          <TextInput
            style={[common.input, styles.multiline]}
            multiline
            numberOfLines={3}
            placeholder="e.g. Resolve gut issues, steady energy, lose 15 lbs."
            value={goals}
            onChangeText={setGoals}
            textAlignVertical="top"
          />

          <TouchableOpacity style={common.primaryButton} onPress={onSave}>
            <Text style={common.primaryButtonText}>
              {savedFlash ? 'Saved ✓' : 'Save profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Weight tracking (optional) */}
        <View style={common.card}>
          <Text style={common.h2}>Weight tracking</Text>
          <Text style={styles.weightHint}>
            Optional — turn this on if you want to log your weight.
          </Text>
          <TouchableOpacity
            style={styles.asNeededRow}
            onPress={() => setTrackWeight(!trackWeight)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, trackWeight && styles.checkboxActive]}>
              {trackWeight && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.asNeededLabel}>Track my weight</Text>
          </TouchableOpacity>
          {trackWeight && (
            <>
              <Text style={common.label}>Starting weight (lbs)</Text>
              <TextInput
                style={common.input}
                keyboardType="decimal-pad"
                placeholder="e.g. 185"
                value={startingWeight}
                onChangeText={setStartingWeight}
              />
            </>
          )}
          <TouchableOpacity style={common.secondaryButton} onPress={saveWeightSettings}>
            <Text style={common.secondaryButtonText}>
              {weightSavedFlash ? 'Saved ✓' : 'Save weight settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Allergies */}
        <View style={common.card}>
          <Text style={common.h2}>Allergies</Text>
          {allergies.map((a) => (
            <Row key={a.id} label={a.name} onDelete={() => { deleteAllergy(a.id); setAllergies(listAllergies()); }} />
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={[common.input, styles.addInput]}
              placeholder="Add allergy"
              value={allergyInput}
              onChangeText={setAllergyInput}
              onSubmitEditing={addAllergyRow}
            />
            <TouchableOpacity style={styles.addButton} onPress={addAllergyRow}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Health conditions */}
        <View style={common.card}>
          <Text style={common.h2}>Health conditions</Text>
          {conditions.map((c) => (
            <Row key={c.id} label={c.name} onDelete={() => { deleteCondition(c.id); setConditions(listConditions()); }} />
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={[common.input, styles.addInput]}
              placeholder="Add condition"
              value={conditionInput}
              onChangeText={setConditionInput}
              onSubmitEditing={addConditionRow}
            />
            <TouchableOpacity style={styles.addButton} onPress={addConditionRow}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Medications & supplements */}
        <View style={common.card}>
          <Text style={common.h2}>Medications & supplements</Text>
          <View style={styles.toggleRow}>
            {(['medication', 'supplement'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.toggleBtn, medSuppTab === t && styles.toggleBtnActive]}
                onPress={() => {
                  setMedSuppTab(t);
                  clearMedSuppForm();
                }}
              >
                <Text style={[styles.toggleText, medSuppTab === t && styles.toggleTextActive]}>
                  {t === 'medication' ? 'Medications' : 'Supplements'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {medSuppTab === 'medication'
            ? medications.map((m) => (
                <Row
                  key={m.id}
                  label={medSuppLabel(m)}
                  onEdit={() => startEditMedSupp('medication', m)}
                  onDelete={() => {
                    deleteMedication(m.id);
                    setMedications(listMedications());
                    if (editingEntry?.tab === 'medication' && editingEntry.id === m.id) {
                      clearMedSuppForm();
                    }
                  }}
                />
              ))
            : supplements.map((s) => (
                <Row
                  key={s.id}
                  label={medSuppLabel(s)}
                  onEdit={() => startEditMedSupp('supplement', s)}
                  onDelete={() => {
                    deleteSupplement(s.id);
                    setSupplements(listSupplements());
                    if (editingEntry?.tab === 'supplement' && editingEntry.id === s.id) {
                      clearMedSuppForm();
                    }
                  }}
                />
              ))}
          <Text style={common.label}>Name</Text>
          <TextInput
            style={common.input}
            placeholder={medSuppTab === 'medication' ? 'e.g. Metformin' : 'e.g. Vitamin D3'}
            value={medName}
            onChangeText={setMedName}
          />
          <Text style={common.label}>What it's for</Text>
          <TextInput
            style={common.input}
            placeholder={medSuppTab === 'medication' ? 'e.g. blood sugar' : 'e.g. immune support'}
            value={medPurpose}
            onChangeText={setMedPurpose}
          />
          <View style={styles.medRow}>
            <View style={styles.medHalf}>
              <Text style={common.label}>Dosage</Text>
              <TextInput
                style={common.input}
                placeholder={medSuppTab === 'medication' ? 'e.g. 500 mg' : 'e.g. 5000 IU'}
                value={medDosage}
                onChangeText={setMedDosage}
              />
            </View>
            <View style={styles.medHalf}>
              <Text style={common.label}>Times / day</Text>
              <TextInput
                style={[common.input, medAsNeeded && styles.disabledInput]}
                keyboardType="number-pad"
                value={medTimes}
                onChangeText={setMedTimes}
                editable={!medAsNeeded}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.asNeededRow}
            onPress={() => setMedAsNeeded(!medAsNeeded)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, medAsNeeded && styles.checkboxActive]}>
              {medAsNeeded && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.asNeededLabel}>As needed (not on a daily schedule)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={common.secondaryButton} onPress={saveMedSuppRow}>
            <Text style={common.secondaryButtonText}>
              {editingEntry
                ? 'Save changes'
                : medSuppTab === 'medication'
                  ? 'Add medication'
                  : 'Add supplement'}
            </Text>
          </TouchableOpacity>
          {editingEntry && (
            <TouchableOpacity
              style={[common.secondaryButton, { marginTop: 8 }]}
              onPress={clearMedSuppForm}
            >
              <Text style={common.secondaryButtonText}>Cancel editing</Text>
            </TouchableOpacity>
          )}
        </View>
    </KeyboardScrollView>
  );
}

function Row({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.row}>
      {onEdit ? (
        <TouchableOpacity style={styles.rowLabelWrap} onPress={onEdit}>
          <Text style={styles.rowLabel}>{label}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.rowLabel}>{label}</Text>
      )}
      <TouchableOpacity onPress={onDelete} style={styles.rowDelete}>
        <Text style={styles.rowDeleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.accent },
  radioLabel: { fontSize: 16, color: COLORS.text, marginLeft: 10 },
  multiline: { minHeight: 90 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { flex: 1, fontSize: 15, color: COLORS.text },
  rowLabelWrap: { flex: 1 },
  rowDelete: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDeleteText: { color: COLORS.danger, fontWeight: '700' },
  addRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  addInput: { flex: 1 },
  addButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  medRow: { flexDirection: 'row', gap: 12 },
  medHalf: { flex: 1 },
  disabledInput: { opacity: 0.4 },
  asNeededRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 15 },
  asNeededLabel: { fontSize: 15, color: COLORS.text },
  weightHint: { fontSize: 14, color: COLORS.muted, marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  toggleBtn: { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: COLORS.card, ...SHADOW },
  toggleText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
  toggleTextActive: { color: COLORS.accent },
});
