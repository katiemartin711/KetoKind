// Profile tab: diet type, personal diet nuances, goals, and editable lists
// for allergies, health conditions, and medications. Everything here feeds
// the AI context file generated on the AI Coach tab.
//
// The tab is composed of focused section components (src/components/profile/);
// this file owns the state and the db-backed handlers.

import React, { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
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
  validateBackup,
} from '../db';
import type { Allergy, Condition, DietType, Medication, Supplement } from '../types';
import { toDietStartString, parseDietStart } from '../milestones';
import { useTheme } from '../ThemeContext';
import KeyboardScrollView from '../components/KeyboardScrollView';
import DietSection from '../components/profile/DietSection';
import type { DietStartParts } from '../components/profile/DietSection';
import AboutSection from '../components/profile/AboutSection';
import type { SexOption } from '../components/profile/AboutSection';
import WeightSection from '../components/profile/WeightSection';
import AppearanceSection from '../components/profile/AppearanceSection';
import SimpleListSection from '../components/profile/SimpleListSection';
import MedSuppSection from '../components/profile/MedSuppSection';
import type {
  EditingEntry,
  MedSuppFormState,
  MedSuppTab,
  SchedulableEntry,
} from '../components/profile/MedSuppSection';
import BackupSection from '../components/profile/BackupSection';
import DangerSection from '../components/profile/DangerSection';

/** parseInt that rejects junk like "12abc" — digits only, or null. */
function parseIntStrict(s: string): number | null {
  const t = s.trim();
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

const EMPTY_MED_SUPP_FORM: MedSuppFormState = {
  name: '',
  dosage: '',
  times: '1',
  purpose: '',
  asNeeded: false,
};

export default function ProfileScreen() {
  const { common, setMode: setAppTheme } = useTheme();
  const [dietType, setDietType] = useState<DietType>('carnivore');
  const [infoDiet, setInfoDiet] = useState<DietType | null>(null);
  const [nuances, setNuances] = useState('');
  const [goals, setGoals] = useState('');
  const [dietStart, setDietStart] = useState<DietStartParts>({ month: '', day: '', year: '' });
  // Last-saved values, powering the permanent "time on diet" callout.
  const [savedDietStart, setSavedDietStart] = useState<string | null>(null);
  const [savedDietType, setSavedDietType] = useState<DietType>('carnivore');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<SexOption>('');
  const [bio, setBio] = useState('');
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [medSuppTab, setMedSuppTab] = useState<MedSuppTab>('medication');
  const [medSuppForm, setMedSuppForm] = useState<MedSuppFormState>(EMPTY_MED_SUPP_FORM);
  // Non-null while an existing medication/supplement is loaded into the form.
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Add-row inputs
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [trackWeight, setTrackWeight] = useState(false);
  const [startingWeight, setStartingWeight] = useState('');
  const [weightSavedFlash, setWeightSavedFlash] = useState(false);

  const refresh = useCallback(() => {
    const p = getProfile();
    setDietType(p.diet_type);
    setNuances(p.diet_nuances);
    setGoals(p.goals);
    const ds = parseDietStart(p.diet_start);
    setDietStart({
      month: ds ? String(ds.month) : '',
      day: ds?.day != null ? String(ds.day) : '',
      year: ds ? String(ds.year) : '',
    });
    setSavedDietStart(p.diet_start);
    setSavedDietType(p.diet_type);
    setName(p.name || '');
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
    let dietStartValue: string | null = null;
    const mStr = dietStart.month.trim();
    const dStr = dietStart.day.trim();
    const yStr = dietStart.year.trim();
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
      dietStartValue = toDietStartString(year, month, day);
    }
    saveProfile(dietType, nuances, goals, ageNum, sex, bio.trim(), dietStartValue, name);
    setSavedDietStart(dietStartValue);
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
            setAppTheme('system'); // delete-all resets the theme too
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
        const [firstIssue] = validateBackup(parsed);
        Alert.alert(
          'Invalid file',
          firstIssue
            ? `That file is not a valid KetoKind backup: ${firstIssue.path} — ${firstIssue.message}`
            : 'That file is not a valid KetoKind backup.',
        );
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
    setMedSuppForm(EMPTY_MED_SUPP_FORM);
    setEditingEntry(null);
  };

  const startEditMedSupp = (tab: MedSuppTab, m: SchedulableEntry) => {
    setMedSuppTab(tab);
    setMedSuppForm({
      name: m.name,
      dosage: m.dosage,
      times: String(m.times_per_day),
      purpose: m.purpose,
      asNeeded: !!m.as_needed,
    });
    setEditingEntry({ tab, id: m.id });
  };

  const saveMedSuppRow = () => {
    const isMed = medSuppTab === 'medication';
    const kind = isMed ? 'medication' : 'supplement';
    if (!medSuppForm.name.trim()) return Alert.alert('Missing name', `Give the ${kind} a name.`);
    const times = parseIntStrict(medSuppForm.times);
    if (!medSuppForm.asNeeded && (times == null || times < 1 || times > 24)) {
      return Alert.alert('Invalid', 'Times per day must be a whole number between 1 and 24.');
    }
    const timesPerDay = times ?? 1; // irrelevant for as-needed items
    if (editingEntry) {
      if (editingEntry.tab === 'medication') {
        updateMedication(editingEntry.id, medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
        setMedications(listMedications());
      } else {
        updateSupplement(editingEntry.id, medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
        setSupplements(listSupplements());
      }
    } else if (isMed) {
      addMedication(medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
      setMedications(listMedications());
    } else {
      addSupplement(medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
      setSupplements(listSupplements());
    }
    clearMedSuppForm();
  };

  const deleteMedicationRow = (id: number) => {
    deleteMedication(id);
    setMedications(listMedications());
    if (editingEntry?.tab === 'medication' && editingEntry.id === id) {
      clearMedSuppForm();
    }
  };

  const deleteSupplementRow = (id: number) => {
    deleteSupplement(id);
    setSupplements(listSupplements());
    if (editingEntry?.tab === 'supplement' && editingEntry.id === id) {
      clearMedSuppForm();
    }
  };

  return (
    <KeyboardScrollView>
      <Text style={common.h1}>Profile</Text>
      <Text style={common.subtitle}>
        This is what gets included in your AI coach context file.
      </Text>

      <AboutSection
        name={name}
        onNameChange={setName}
        age={age}
        onAgeChange={setAge}
        sex={sex}
        onSexChange={setSex}
        bio={bio}
        onBioChange={setBio}
      />

      <DietSection
        dietType={dietType}
        infoDiet={infoDiet}
        onSelectDiet={(d) => {
          setDietType(d);
          setSavedDietType(d);
          persistDietType(d);
        }}
        onToggleInfo={(d) => setInfoDiet(infoDiet === d ? null : d)}
        nuances={nuances}
        onNuancesChange={setNuances}
        goals={goals}
        onGoalsChange={setGoals}
        dietStart={dietStart}
        onDietStartChange={(part, value) => setDietStart((s) => ({ ...s, [part]: value }))}
        savedDietStart={savedDietStart}
        savedDietType={savedDietType}
        savedFlash={savedFlash}
        onSave={onSave}
      />

      <WeightSection
        trackWeight={trackWeight}
        onTrackWeightChange={setTrackWeight}
        startingWeight={startingWeight}
        onStartingWeightChange={setStartingWeight}
        savedFlash={weightSavedFlash}
        onSave={saveWeightSettings}
      />

      <AppearanceSection />

      <SimpleListSection
        title="Allergies"
        items={allergies}
        inputValue={allergyInput}
        onInputChange={setAllergyInput}
        inputPlaceholder="Add allergy"
        onAdd={addAllergyRow}
        onDelete={(id) => {
          deleteAllergy(id);
          setAllergies(listAllergies());
        }}
      />

      <SimpleListSection
        title="Health conditions"
        items={conditions}
        inputValue={conditionInput}
        onInputChange={setConditionInput}
        inputPlaceholder="Add condition"
        onAdd={addConditionRow}
        onDelete={(id) => {
          deleteCondition(id);
          setConditions(listConditions());
        }}
      />

      <MedSuppSection
        tab={medSuppTab}
        onTabChange={(t) => {
          setMedSuppTab(t);
          clearMedSuppForm();
        }}
        medications={medications}
        supplements={supplements}
        editingEntry={editingEntry}
        form={medSuppForm}
        onFormChange={(patch) => setMedSuppForm((f) => ({ ...f, ...patch }))}
        onSave={saveMedSuppRow}
        onCancelEdit={clearMedSuppForm}
        onStartEdit={startEditMedSupp}
        onDeleteMedication={deleteMedicationRow}
        onDeleteSupplement={deleteSupplementRow}
      />

      <BackupSection onDownload={downloadBackup} onImport={importBackupFile} />

      <DangerSection onDelete={confirmDeleteAllData} />
    </KeyboardScrollView>
  );
}
