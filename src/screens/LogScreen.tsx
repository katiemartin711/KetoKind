// Log tab: segmented forms for Meal / Meds & Supps / Symptom / Weight,
// plus today's entries across all types with edit and delete on each.
//
// The tab is composed of focused form components (src/components/log/);
// this file owns the state and the db-backed handlers.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  addFoodLog,
  addMedLog,
  addSupplementLog,
  addSymptomLog,
  addWeightLog,
  deleteLog,
  getFoodLog,
  getLogsForDay,
  getMedLog,
  getProfile,
  getSupplementLog,
  getSymptomLog,
  getWeightLog,
  listMedications,
  listSupplements,
  updateFoodLog,
  updateMedLog,
  updateSupplementLog,
  updateSymptomLog,
  updateWeightLog,
} from '../db';
import type { AnyLog, LogSegment, Medication, RootTabParamList, Supplement } from '../types';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';
import KeyboardScrollView from '../components/KeyboardScrollView';
import MealForm from '../components/log/MealForm';
import MedSuppForm from '../components/log/MedSuppForm';
import SymptomForm from '../components/log/SymptomForm';
import WeightForm from '../components/log/WeightForm';
import TodayEntries from '../components/log/TodayEntries';

type LogRoute = RouteProp<RootTabParamList, 'Log'>;

const SEGMENTS: { key: LogSegment; label: string }[] = [
  { key: 'meal', label: 'Meal' },
  { key: 'medsupp', label: 'Meds & Supps' },
  { key: 'symptom', label: 'Symptom' },
];

export default function LogScreen() {
  const route = useRoute<LogRoute>();
  const { colors: COLORS, common } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [segment, setSegment] = useState<LogSegment>('meal');
  const [todayLogs, setTodayLogs] = useState<AnyLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [profileSupps, setProfileSupps] = useState<Supplement[]>([]);

  // Form state
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState('Dinner');
  const [mealNotes, setMealNotes] = useState('');
  const [selectedMedIds, setSelectedMedIds] = useState<number[]>([]);
  const [selectedSuppIds, setSelectedSuppIds] = useState<number[]>([]);
  // "How many" per selected item (only used for as-needed items).
  const [medQty, setMedQty] = useState<Record<number, number>>({});
  const [suppQty, setSuppQty] = useState<Record<number, number>>({});
  const [symptomName, setSymptomName] = useState('');
  const [severity, setSeverity] = useState(3);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [trackWeightOn, setTrackWeightOn] = useState(false);

  // Timestamp for the entry being created/edited — defaults to right now.
  const [logDate, setLogDate] = useState<Date>(new Date());
  // Non-null while an existing entry is loaded into the form for editing.
  const [editing, setEditing] = useState<{ kind: AnyLog['kind']; id: number } | null>(null);

  const refresh = useCallback(() => {
    setTodayLogs(getLogsForDay(new Date()));
    // Drop selections whose profile entry was deleted since.
    const meds = listMedications();
    setMedications(meds);
    setSelectedMedIds((ids) => ids.filter((id) => meds.some((m) => m.id === id)));
    const supps = listSupplements();
    setProfileSupps(supps);
    setSelectedSuppIds((ids) => ids.filter((id) => supps.some((s) => s.id === id)));
    setTrackWeightOn(!!getProfile().track_weight);
  }, []);

  useFocusEffect(refresh);

  // Dashboard quick-add buttons navigate here with a segment param.
  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  // The Weight segment only exists while weight tracking is enabled.
  const visibleSegments: { key: LogSegment; label: string }[] = trackWeightOn
    ? [...SEGMENTS, { key: 'weight', label: 'Weight' }]
    : SEGMENTS;

  useEffect(() => {
    if (!trackWeightOn && segment === 'weight') setSegment('meal');
  }, [trackWeightOn, segment]);

  const saveMeal = () => {
    if (!mealName.trim()) return Alert.alert('Missing name', 'What did you eat?');
    const at = logDate.toISOString();
    if (editing?.kind === 'meal') {
      updateFoodLog(editing.id, mealName, mealType, mealNotes, at);
    } else {
      addFoodLog(mealName, mealType, mealNotes, at);
    }
    resetForm();
    refresh();
  };

  /** Toggle an id in a multi-select list. */
  const toggleId = (ids: number[], id: number) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

  /**
   * Log every selected medication and supplement with one tap, sharing the
   * same timestamp — for the after-a-meal handful of pills.
   */
  const saveMedSupp = () => {
    if (selectedMedIds.length === 0 && selectedSuppIds.length === 0) {
      return Alert.alert('Nothing selected', 'Pick at least one medication or supplement first.');
    }
    const at = logDate.toISOString();
    if (editing?.kind === 'medication' && selectedMedIds.length > 0) {
      updateMedLog(editing.id, selectedMedIds[0], at, medQty[selectedMedIds[0]] ?? 1);
    } else if (editing?.kind === 'supplement' && selectedSuppIds.length > 0) {
      updateSupplementLog(editing.id, selectedSuppIds[0], at, suppQty[selectedSuppIds[0]] ?? 1);
    } else if (!editing) {
      selectedMedIds.forEach((id) => addMedLog(id, at, medQty[id] ?? 1));
      selectedSuppIds.forEach((id) => addSupplementLog(id, at, suppQty[id] ?? 1));
    }
    resetForm();
    refresh();
  };

  /** In edit mode the other section is locked so a single entry stays single. */
  const onToggleMed = (id: number) => {
    if (editing?.kind === 'supplement') return;
    if (editing?.kind === 'medication') {
      setSelectedMedIds([id]);
      setMedQty((q) => ({ ...q, [id]: q[id] ?? 1 }));
      return;
    }
    const isOn = selectedMedIds.includes(id);
    setSelectedMedIds(toggleId(selectedMedIds, id));
    setMedQty((q) => {
      if (!isOn) return { ...q, [id]: q[id] ?? 1 };
      const { [id]: _drop, ...rest } = q;
      return rest;
    });
  };

  const onToggleSupp = (id: number) => {
    if (editing?.kind === 'medication') return;
    if (editing?.kind === 'supplement') {
      setSelectedSuppIds([id]);
      setSuppQty((q) => ({ ...q, [id]: q[id] ?? 1 }));
      return;
    }
    const isOn = selectedSuppIds.includes(id);
    setSelectedSuppIds(toggleId(selectedSuppIds, id));
    setSuppQty((q) => {
      if (!isOn) return { ...q, [id]: q[id] ?? 1 };
      const { [id]: _drop, ...rest } = q;
      return rest;
    });
  };

  /** Stepper for "how many did you take" on as-needed items. */
  const bumpQty = (kind: 'med' | 'supp', id: number, delta: number) => {
    const set = kind === 'med' ? setMedQty : setSuppQty;
    set((q) => ({ ...q, [id]: Math.min(20, Math.max(1, (q[id] ?? 1) + delta)) }));
  };

  const saveSymptom = () => {
    if (!symptomName.trim()) return Alert.alert('Missing name', 'What symptom are you logging?');
    const at = logDate.toISOString();
    if (editing?.kind === 'symptom') {
      updateSymptomLog(editing.id, symptomName, severity, symptomNotes, at);
    } else {
      addSymptomLog(symptomName, severity, symptomNotes, at);
    }
    resetForm();
    refresh();
  };

  const saveWeight = () => {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) return Alert.alert('Invalid', 'Enter your weight in lbs.');
    const at = logDate.toISOString();
    if (editing?.kind === 'weight') {
      updateWeightLog(editing.id, w, at);
    } else {
      addWeightLog(w, at);
    }
    resetForm();
    refresh();
  };

  /** Clear the form back to a fresh entry. */
  const resetForm = () => {
    setMealName('');
    setMealNotes('');
    setMealType('Dinner');
    setSelectedMedIds([]);
    setSelectedSuppIds([]);
    setMedQty({});
    setSuppQty({});
    setSymptomName('');
    setSymptomNotes('');
    setSeverity(3);
    setWeightInput('');
    setLogDate(new Date());
    setEditing(null);
  };

  /** Load an existing entry into the form so it can be edited (time included). */
  const startEdit = (log: AnyLog) => {
    resetForm();
    if (log.kind === 'meal') {
      const row = getFoodLog(log.id);
      if (!row) return;
      setMealName(row.name);
      setMealType(row.meal_type);
      setMealNotes(row.notes);
      setLogDate(new Date(row.logged_at));
    } else if (log.kind === 'medication') {
      const row = getMedLog(log.id);
      if (!row) return;
      // The medication may have been deleted from the profile since — don't
      // keep an invisible selection; the user picks a current one instead.
      const stillExists = medications.some((m) => m.id === row.medication_id);
      setSelectedMedIds(stillExists ? [row.medication_id] : []);
      setSelectedSuppIds([]);
      setMedQty(stillExists ? { [row.medication_id]: row.quantity ?? 1 } : {});
      setSuppQty({});
      setLogDate(new Date(row.taken_at));
    } else if (log.kind === 'symptom') {
      const row = getSymptomLog(log.id);
      if (!row) return;
      setSymptomName(row.name);
      setSeverity(row.severity);
      setSymptomNotes(row.notes);
      setLogDate(new Date(row.logged_at));
    } else if (log.kind === 'weight') {
      if (!trackWeightOn) return; // tracking was turned off in Profile
      const row = getWeightLog(log.id);
      if (!row) return;
      setWeightInput(String(row.weight));
      setLogDate(new Date(row.logged_at));
    } else if (log.kind === 'supplement') {
      const row = getSupplementLog(log.id);
      if (!row) return;
      // Legacy free-text logs (or ones whose supplement was deleted) have no
      // live profile entry — the user just picks again.
      setSelectedSuppIds(row.supplement_id != null ? [row.supplement_id] : []);
      setSelectedMedIds([]);
      setSuppQty(row.supplement_id != null ? { [row.supplement_id]: row.quantity ?? 1 } : {});
      setMedQty({});
      setLogDate(new Date(row.logged_at));
    }
    setSegment(log.kind === 'medication' || log.kind === 'supplement' ? 'medsupp' : log.kind);
    setEditing({ kind: log.kind, id: log.id });
  };

  const confirmDelete = (log: AnyLog) => {
    Alert.alert('Delete entry?', `"${log.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteLog(log.kind, log.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <KeyboardScrollView>
      <Text style={common.h1}>Log</Text>
      <Text style={common.subtitle}>What did you eat, take, or feel?</Text>

      {/* Segmented control */}
      <View style={styles.segments}>
        {visibleSegments.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.segment, segment === s.key && styles.segmentActive]}
            onPress={() => {
              setSegment(s.key);
              // Switching forms exits edit mode; the time resets to now.
              setEditing(null);
              setLogDate(new Date());
            }}
          >
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {segment === 'meal' && (
        <MealForm
          mealName={mealName}
          onMealNameChange={setMealName}
          mealType={mealType}
          onMealTypeChange={setMealType}
          mealNotes={mealNotes}
          onMealNotesChange={setMealNotes}
          logDate={logDate}
          onLogDateChange={setLogDate}
          editing={editing?.kind === 'meal'}
          onSave={saveMeal}
          onCancel={resetForm}
        />
      )}

      {segment === 'medsupp' && (
        <MedSuppForm
          medications={medications}
          profileSupps={profileSupps}
          selectedMedIds={selectedMedIds}
          selectedSuppIds={selectedSuppIds}
          medQty={medQty}
          suppQty={suppQty}
          onToggleMed={onToggleMed}
          onToggleSupp={onToggleSupp}
          onBumpQty={bumpQty}
          logDate={logDate}
          onLogDateChange={setLogDate}
          editingKind={
            editing?.kind === 'medication' || editing?.kind === 'supplement' ? editing.kind : null
          }
          onSave={saveMedSupp}
          onCancel={resetForm}
        />
      )}

      {segment === 'symptom' && (
        <SymptomForm
          symptomName={symptomName}
          onSymptomNameChange={setSymptomName}
          severity={severity}
          onSeverityChange={setSeverity}
          symptomNotes={symptomNotes}
          onSymptomNotesChange={setSymptomNotes}
          logDate={logDate}
          onLogDateChange={setLogDate}
          editing={editing?.kind === 'symptom'}
          onSave={saveSymptom}
          onCancel={resetForm}
        />
      )}

      {segment === 'weight' && (
        <WeightForm
          weightInput={weightInput}
          onWeightInputChange={setWeightInput}
          logDate={logDate}
          onLogDateChange={setLogDate}
          editing={editing?.kind === 'weight'}
          onSave={saveWeight}
          onCancel={resetForm}
        />
      )}

      <TodayEntries logs={todayLogs} onEdit={startEdit} onDelete={confirmDelete} />
    </KeyboardScrollView>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    segments: {
      flexDirection: 'row',
      backgroundColor: C.border,
      borderRadius: 12,
      padding: 4,
      marginBottom: 12,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentActive: { backgroundColor: C.card },
    segmentText: { fontSize: 13, fontWeight: '600', color: C.muted },
    segmentTextActive: { color: C.accent },
  });
