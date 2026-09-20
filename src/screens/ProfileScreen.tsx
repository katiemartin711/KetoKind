// Profile tab: diet type, personal diet nuances, goals, and editable lists
// for allergies, health conditions, and medications. Everything here feeds
// the AI context file generated on the AI Coach tab.

import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
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
  deleteAllergy,
  deleteCondition,
  deleteMedication,
  getProfile,
  listAllergies,
  listConditions,
  listMedications,
  saveProfile,
} from '../db';
import type { Allergy, Condition, DietType, Medication } from '../types';
import { DIET_LABELS, DIET_TYPES } from '../types';
import { COLORS, common } from '../theme';

export default function ProfileScreen() {
  const [dietType, setDietType] = useState<DietType>('carnivore');
  const [nuances, setNuances] = useState('');
  const [goals, setGoals] = useState('');
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  // Add-row inputs
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medTimes, setMedTimes] = useState('1');

  const refresh = useCallback(() => {
    const p = getProfile();
    setDietType(p.diet_type);
    setNuances(p.diet_nuances);
    setGoals(p.goals);
    setAllergies(listAllergies());
    setConditions(listConditions());
    setMedications(listMedications());
  }, []);

  useFocusEffect(refresh);

  const onSave = () => {
    saveProfile(dietType, nuances, goals);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
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

  const addMedicationRow = () => {
    if (!medName.trim()) return Alert.alert('Missing name', 'Give the medication a name.');
    const times = parseInt(medTimes, 10);
    if (isNaN(times) || times < 1) return Alert.alert('Invalid', 'Times per day must be at least 1.');
    addMedication(medName, medDosage, times);
    setMedName('');
    setMedDosage('');
    setMedTimes('1');
    setMedications(listMedications());
  };

  return (
    <View style={common.screen}>
      <ScrollView contentContainerStyle={common.scroll} keyboardShouldPersistTaps="handled">
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

        {/* Medications */}
        <View style={common.card}>
          <Text style={common.h2}>Medications</Text>
          {medications.map((m) => (
            <Row
              key={m.id}
              label={`${m.name}${m.dosage ? ` — ${m.dosage}` : ''} (${m.times_per_day}x/day)`}
              onDelete={() => { deleteMedication(m.id); setMedications(listMedications()); }}
            />
          ))}
          <Text style={common.label}>Name</Text>
          <TextInput
            style={common.input}
            placeholder="e.g. Vitamin D3"
            value={medName}
            onChangeText={setMedName}
          />
          <View style={styles.medRow}>
            <View style={styles.medHalf}>
              <Text style={common.label}>Dosage</Text>
              <TextInput
                style={common.input}
                placeholder="e.g. 5000 IU"
                value={medDosage}
                onChangeText={setMedDosage}
              />
            </View>
            <View style={styles.medHalf}>
              <Text style={common.label}>Times / day</Text>
              <TextInput
                style={common.input}
                keyboardType="number-pad"
                value={medTimes}
                onChangeText={setMedTimes}
              />
            </View>
          </View>
          <TouchableOpacity style={common.secondaryButton} onPress={addMedicationRow}>
            <Text style={common.secondaryButtonText}>Add medication</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
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
});
