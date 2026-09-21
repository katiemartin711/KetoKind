// Profile tab: diet type, personal diet nuances, goals, and editable lists
// for allergies, health conditions, and medications. Everything here feeds
// the AI context file generated on the AI Coach tab.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  addAllergy,
  addCondition,
  addMedication,
  addSupplement,
  deleteAllergy,
  deleteAllData,
  deleteCondition,
  deleteMedication,
  deleteSupplement,
  exportBackup,
  getProfile,
  importBackup,
  isDatabaseBackup,
  listAllergies,
  listConditions,
  listMedications,
  listSupplements,
  persistDietType,
  saveProfile,
  setWeightTracking,
  updateMedication,
  updateSupplement,
} from '../db';
import type { Allergy, Condition, DietType, Medication, Supplement } from '../types';
import { DIET_LABELS, DIET_TYPES } from '../types';
import { SHADOW } from '../theme';
import { toDietStartString, parseDietStart, formatDietStart, dietDurationLabel } from '../milestones';
import { useTheme } from '../ThemeContext';
import type { Palette, ThemeMode } from '../theme';
import KeyboardScrollView from '../components/KeyboardScrollView';

/** parseInt that rejects junk like "12abc" — digits only, or null. */
function parseIntStrict(s: string): number | null {
  const t = s.trim();
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

export default function ProfileScreen() {
  const { colors, common, mode: themeMode, setMode: setAppTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dietType, setDietType] = useState<DietType>('carnivore');
  const [nuances, setNuances] = useState('');
  const [goals, setGoals] = useState('');
  const [dietStartMonth, setDietStartMonth] = useState('');
  const [dietStartDay, setDietStartDay] = useState('');
  const [dietStartYear, setDietStartYear] = useState('');
  // Last-saved values, powering the permanent "time on diet" callout.
  const [savedDietStart, setSavedDietStart] = useState<string | null>(null);
  const [savedDietType, setSavedDietType] = useState<DietType>('carnivore');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'female' | 'male' | ''>('');
  const [bio, setBio] = useState('');
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
    const ds = parseDietStart(p.diet_start);
    setDietStartMonth(ds ? String(ds.month) : '');
    setDietStartDay(ds?.day != null ? String(ds.day) : '');
    setDietStartYear(ds ? String(ds.year) : '');
    setSavedDietStart(p.diet_start);
    setSavedDietType(p.diet_type);
    setAge(p.age != null ? String(p.age) : '');
    setSex(p.sex === 'female' || p.sex === 'male' ? p.sex : '');
    setBio(p.bio || '');
    setAllergies(listAllergies());
    setConditions(listConditions());
    setMedications(listMedications());
    setSupplements(listSupplements());
    setTrackWeight(!!p.track_weight);
    setStartingWeight(p.starting_weight != null ? String(p.starting_weight) : '');
  }, []);

  useFocusEffect(refresh);

  const onSave = () => {
    let ageNum: number | null = null;
    if (age.trim() !== '') {
      const n = parseIntStrict(age);
      if (n == null || n < 1 || n > 120) {
        return Alert.alert('Invalid', 'Age must be a whole number between 1 and 120, or leave it blank.');
      }
      ageNum = n;
    }
    // Diet start date: month + year required, day optional. Blank = not set.
    let dietStart: string | null = null;
    const mStr = dietStartMonth.trim();
    const dStr = dietStartDay.trim();
    const yStr = dietStartYear.trim();
    if (mStr !== '' || dStr !== '' || yStr !== '') {
      const nowYear = new Date().getFullYear();
      if (mStr === '' || yStr === '') {
        return Alert.alert('Invalid', 'Enter at least the month and year you started your diet, or leave all three blank.');
      }
      const month = parseIntStrict(mStr);
      const year = parseIntStrict(yStr);
      if (month == null || month < 1 || month > 12) {
        return Alert.alert('Invalid', 'Diet start month must be between 1 and 12.');
      }
      if (year == null || year < 1990 || year > nowYear) {
        return Alert.alert('Invalid', `Diet start year must be between 1990 and ${nowYear}.`);
      }
      let day: number | null = null;
      if (dStr !== '') {
        day = parseIntStrict(dStr);
        const daysInMonth = new Date(year, month, 0).getDate();
        if (day == null || day < 1 || day > daysInMonth) {
          return Alert.alert('Invalid', `Diet start day must be between 1 and ${daysInMonth} for that month.`);
        }
      }
      const start = new Date(year, month - 1, day ?? 1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (start.getTime() > today.getTime()) {
        return Alert.alert('Invalid', 'Your diet start date can’t be in the future.');
      }
      dietStart = toDietStartString(year, month, day);
    }
    saveProfile(dietType, nuances, goals, ageNum, sex, bio.trim(), dietStart);
    setSavedDietStart(dietStart);
    setSavedDietType(dietType);
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

  const confirmDeleteAllData = () => {
    Alert.alert(
      'Delete all data?',
      'This permanently deletes your profile, logs, medications, supplements, and weight history on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            deleteAllData();
            clearMedSuppForm();
            refresh();
            Alert.alert('Done', 'All data has been deleted from this device.');
          },
        },
      ],
    );
  };

  const downloadBackup = async () => {
    try {
      const backup = exportBackup();
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const uri = `${documentDirectory}ketokind-backup-${stamp}.json`;
      await writeAsStringAsync(uri, JSON.stringify(backup));
      await Sharing.shareAsync(uri, { mimeType: 'application/json' });
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Could not create the backup file.');
    }
  };

  const importBackupFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readAsStringAsync(uri));
      } catch {
        parsed = null;
      }
      if (!isDatabaseBackup(parsed)) {
        Alert.alert('Invalid file', 'That file is not a valid KetoKind backup.');
        return;
      }
      const backup = parsed;
      Alert.alert(
        'Replace all data?',
        'Importing will replace everything currently on this device with the backup. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: () => {
              try {
                importBackup(backup);
                clearMedSuppForm();
                refresh();
                const mode = backup.profile.theme_mode;
                setAppTheme(mode === 'light' || mode === 'dark' ? mode : 'system');
                Alert.alert('Done', 'Backup imported successfully.');
              } catch (e) {
                Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import the backup.');
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not read the file.');
    }
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
    const times = parseIntStrict(medTimes);
    if (!medAsNeeded && (times == null || times < 1 || times > 24)) {
      return Alert.alert('Invalid', 'Times per day must be a whole number between 1 and 24.');
    }
    const timesPerDay = times ?? 1; // irrelevant for as-needed items
    if (editingEntry) {
      if (editingEntry.tab === 'medication') {
        updateMedication(editingEntry.id, medName, medDosage, timesPerDay, medPurpose, medAsNeeded);
        setMedications(listMedications());
      } else {
        updateSupplement(editingEntry.id, medName, medDosage, timesPerDay, medPurpose, medAsNeeded);
        setSupplements(listSupplements());
      }
    } else if (isMed) {
      addMedication(medName, medDosage, timesPerDay, medPurpose, medAsNeeded);
      setMedications(listMedications());
    } else {
      addSupplement(medName, medDosage, timesPerDay, medPurpose, medAsNeeded);
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
            <TouchableOpacity
              key={d}
              style={styles.radioRow}
              onPress={() => {
                setDietType(d);
                setSavedDietType(d);
                persistDietType(d);
              }}
            >
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
            maxLength={500}
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
            maxLength={300}
          />

          <Text style={common.label}>When did you start your diet?</Text>
          <Text style={styles.weightHint}>
            Month and year are enough — add the day if you know it. Used for milestone celebrations.
          </Text>
          <View style={styles.medRow}>
            <View style={styles.medHalf}>
              <Text style={common.label}>Month</Text>
              <TextInput
                style={common.input}
                keyboardType="number-pad"
                placeholder="e.g. 3"
                value={dietStartMonth}
                onChangeText={setDietStartMonth}
                maxLength={2}
              />
            </View>
            <View style={styles.medHalf}>
              <Text style={common.label}>Day (optional)</Text>
              <TextInput
                style={common.input}
                keyboardType="number-pad"
                placeholder="e.g. 14"
                value={dietStartDay}
                onChangeText={setDietStartDay}
                maxLength={2}
              />
            </View>
            <View style={styles.medHalf}>
              <Text style={common.label}>Year</Text>
              <TextInput
                style={common.input}
                keyboardType="number-pad"
                placeholder="e.g. 2024"
                value={dietStartYear}
                onChangeText={setDietStartYear}
                maxLength={4}
              />
            </View>
          </View>

          {savedDietStart ? (
            <View style={styles.dietCallout}>
              <Text style={styles.dietCalloutText}>
                🎉 {dietDurationLabel(savedDietStart)} on {DIET_LABELS[savedDietType]} — since {formatDietStart(savedDietStart)}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={common.primaryButton} onPress={onSave}>
            <Text style={common.primaryButtonText}>
              {savedFlash ? 'Saved ✓' : 'Save profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* About you */}
        <View style={common.card}>
          <Text style={common.h2}>About you</Text>
          <Text style={styles.weightHint}>
            Helps your AI coach give age-appropriate guidance.
          </Text>
          <Text style={common.label}>Age</Text>
          <TextInput
            style={common.input}
            keyboardType="number-pad"
            placeholder="e.g. 32"
            value={age}
            onChangeText={setAge}
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
                onPress={() => setSex(sex === o.key ? '' : o.key)}
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
            onChangeText={setBio}
            textAlignVertical="top"
            maxLength={500}
          />
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
                maxLength={7}
              />
            </>
          )}
          <TouchableOpacity style={common.secondaryButton} onPress={saveWeightSettings}>
            <Text style={common.secondaryButtonText}>
              {weightSavedFlash ? 'Saved ✓' : 'Save weight settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <View style={common.card}>
          <Text style={common.h2}>Appearance</Text>
          {(
            [
              { key: 'system', label: 'System default', hint: "Follows your phone's light / dark setting" },
              { key: 'light', label: 'Light' },
              { key: 'dark', label: 'Dark' },
            ] as { key: ThemeMode; label: string; hint?: string }[]
          ).map((o) => (
            <TouchableOpacity key={o.key} style={styles.radioRow} onPress={() => setAppTheme(o.key)}>
              <View style={[styles.radio, themeMode === o.key && styles.radioActive]}>
                {themeMode === o.key && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>{o.label}</Text>
                {o.hint ? <Text style={styles.radioHint}>{o.hint}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
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
              maxLength={80}
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
              maxLength={80}
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
            maxLength={80}
          />
          <Text style={common.label}>What it's for</Text>
          <TextInput
            style={common.input}
            placeholder={medSuppTab === 'medication' ? 'e.g. blood sugar' : 'e.g. immune support'}
            value={medPurpose}
            onChangeText={setMedPurpose}
            maxLength={120}
          />
          <View style={styles.medRow}>
            <View style={styles.medHalf}>
              <Text style={common.label}>Dosage</Text>
              <TextInput
                style={common.input}
                placeholder={medSuppTab === 'medication' ? 'e.g. 500 mg' : 'e.g. 5000 IU'}
                value={medDosage}
                onChangeText={setMedDosage}
                maxLength={40}
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
                maxLength={2}
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

        {/* Data backup */}
        <View style={common.card}>
          <Text style={common.h2}>Data backup</Text>
          <Text style={styles.weightHint}>
            Download a backup file with all your data, or restore from one — handy when
            switching phones. Save the file somewhere safe; anyone with it can read your logs.
          </Text>
          <TouchableOpacity style={common.secondaryButton} onPress={downloadBackup}>
            <Text style={common.secondaryButtonText}>Download all data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={common.secondaryButton} onPress={importBackupFile}>
            <Text style={common.secondaryButtonText}>Import data</Text>
          </TouchableOpacity>
        </View>

        {/* Delete all data */}
        <View style={common.card}>
          <Text style={common.h2}>Delete all data</Text>
          <Text style={styles.weightHint}>
            Permanently wipes your profile, logs, medications, supplements, and weight
            history from this device. Useful if you want to start fresh.
          </Text>
          <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteAllData}>
            <Text style={styles.deleteButtonText}>Delete all data</Text>
          </TouchableOpacity>
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  radioHint: { fontSize: 13, color: C.muted, marginLeft: 10, marginTop: 2 },
  multiline: { minHeight: 90 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLabel: { flex: 1, fontSize: 15, color: C.text },
  rowLabelWrap: { flex: 1 },
  rowDelete: {
    backgroundColor: C.dangerLight,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDeleteText: { color: C.danger, fontWeight: '700' },
  addRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  addInput: { flex: 1 },
  addButton: {
    backgroundColor: C.accent,
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
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 15 },
  asNeededLabel: { fontSize: 15, color: C.text },
  weightHint: { fontSize: 14, color: C.muted, marginBottom: 4 },
  dietCallout: {
    backgroundColor: C.accentLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  dietCalloutText: { fontSize: 14, color: C.text, fontWeight: '600' },
  deleteButton: {
    backgroundColor: C.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
