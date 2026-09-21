// Log tab state machine: form state, the db-backed save/edit/delete
// handlers, and the navigation-param effects (dashboard quick-add segments,
// all-logs editEntry). The screen component (src/screens/LogScreen.tsx)
// only composes the UI from what this hook returns.

import { useCallback, useEffect, useReducer, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
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
  getSupplementLog,
  getSymptomLog,
  getWeightLog,
  updateFoodLog,
  updateMedLog,
  updateSupplementLog,
  updateSymptomLog,
  updateWeightLog,
} from '../../db/logs';
import { getProfile } from '../../db/profile';
import { listMedications, listSupplements } from '../../db/catalog';
import type { AnyLog, LogSegment, Medication, RootTabParamList, Supplement } from '../../types';
import { parseFloatStrict } from '../../numberParsing';
import {
  initialMedSuppSelection,
  medSuppSelectionReducer,
  type EditingKind,
} from './medSuppSelection';
import type { SegmentOption } from './SegmentTabs';

type LogRoute = RouteProp<RootTabParamList, 'Log'>;

const SEGMENTS: SegmentOption[] = [
  { key: 'meal', label: 'Meal' },
  { key: 'medsupp', label: 'Meds & Supps' },
  { key: 'symptom', label: 'Symptom' },
];

export function useLogScreen() {
  const route = useRoute<LogRoute>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [segment, setSegment] = useState<LogSegment>('meal');
  const [todayLogs, setTodayLogs] = useState<AnyLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [profileSupps, setProfileSupps] = useState<Supplement[]>([]);

  // Form state
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState('Dinner');
  const [mealNotes, setMealNotes] = useState('');
  // Med/supp chip selection + per-item quantities, as one state machine
  // (edit-mode locking lives in the reducer).
  const [sel, dispatchSel] = useReducer(medSuppSelectionReducer, initialMedSuppSelection);
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
    const meds = listMedications();
    setMedications(meds);
    const supps = listSupplements();
    setProfileSupps(supps);
    // Drop selections whose profile entry was deleted since.
    dispatchSel({
      type: 'prune',
      validMedIds: meds.map((m) => m.id),
      validSuppIds: supps.map((s) => s.id),
    });
    setTrackWeightOn(!!getProfile().track_weight);
  }, []);

  useFocusEffect(refresh);

  // Dashboard quick-add buttons navigate here with a segment param.
  // Mirrors tapping the segmented control below: switching forms exits edit
  // mode and resets the time to now. Without the setEditing(null), arriving
  // here mid-edit would leave a stale `editing` that matches no branch of
  // the save handler, silently discarding the new selections.
  //
  // The all-logs list screen navigates here with editEntry instead: the
  // entry is loaded into the form for editing. The param is consumed
  // immediately so returning to the tab later doesn't re-enter edit mode.
  // Fresh db reads (not possibly-stale state) feed startEdit, since the tab
  // may never have been focused in this session.
  const editEntryParam = route.params?.editEntry;
  const segmentParam = route.params?.segment;
  useEffect(() => {
    if (editEntryParam) {
      tabNavigation.setParams({ editEntry: undefined });
      startEdit(editEntryParam, {
        medications: listMedications(),
        trackWeight: !!getProfile().track_weight,
      });
    } else if (segmentParam) {
      setSegment(segmentParam);
      setEditing(null);
      setLogDate(new Date());
    }
    // startEdit intentionally omitted: this effect answers param changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntryParam, segmentParam]);

  // The Weight segment only exists while weight tracking is enabled.
  const visibleSegments: SegmentOption[] = trackWeightOn
    ? [...SEGMENTS, { key: 'weight', label: 'Weight' }]
    : SEGMENTS;

  useEffect(() => {
    if (!trackWeightOn && segment === 'weight') setSegment('meal');
  }, [trackWeightOn, segment]);

  /** Switching forms exits edit mode; the time resets to now. */
  const selectSegment = (key: LogSegment) => {
    setSegment(key);
    setEditing(null);
    setLogDate(new Date());
  };

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

  /**
   * Log every selected medication and supplement with one tap, sharing the
   * same timestamp — for the after-a-meal handful of pills.
   */
  const saveMedSupp = () => {
    const { selectedMedIds, selectedSuppIds, medQty, suppQty } = sel;
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

  /** Non-null while editing a single med/supplement entry (locks the other section). */
  const editingKind: EditingKind =
    editing?.kind === 'medication' || editing?.kind === 'supplement' ? editing.kind : null;

  /** Toggle a medication chip (no-op while a supplement entry is being edited). */
  const onToggleMed = (id: number) => dispatchSel({ type: 'toggle-med', id, editingKind });

  /** Toggle a supplement chip (no-op while a medication entry is being edited). */
  const onToggleSupp = (id: number) => dispatchSel({ type: 'toggle-supp', id, editingKind });

  /** Stepper for "how many did you take" on as-needed items. */
  const bumpQty = (kind: 'med' | 'supp', id: number, delta: number) => {
    dispatchSel({ type: 'bump-qty', kind, id, delta });
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
    const w = parseFloatStrict(weightInput);
    if (w == null || w <= 0) return Alert.alert('Invalid', 'Enter your weight in lbs.');
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
    dispatchSel({ type: 'reset' });
    setSymptomName('');
    setSymptomNotes('');
    setSeverity(3);
    setWeightInput('');
    setLogDate(new Date());
    setEditing(null);
  };

  /** Load an existing entry into the form so it can be edited (time included).
   *  `ctx` lets callers pass fresh db reads instead of possibly-stale state —
   *  used when arriving from the all-logs screen before this tab was focused. */
  const startEdit = (
    log: { kind: AnyLog['kind']; id: number },
    ctx?: { medications?: Medication[]; trackWeight?: boolean },
  ) => {
    const meds = ctx?.medications ?? medications;
    const weightOn = ctx?.trackWeight ?? trackWeightOn;
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
      const stillExists = meds.some((m) => m.id === row.medication_id);
      dispatchSel({
        type: 'load-selection',
        medIds: stillExists ? [row.medication_id] : [],
        suppIds: [],
        medQty: stillExists ? { [row.medication_id]: row.quantity ?? 1 } : {},
        suppQty: {},
      });
      setLogDate(new Date(row.taken_at));
    } else if (log.kind === 'symptom') {
      const row = getSymptomLog(log.id);
      if (!row) return;
      setSymptomName(row.name);
      setSeverity(row.severity);
      setSymptomNotes(row.notes);
      setLogDate(new Date(row.logged_at));
    } else if (log.kind === 'weight') {
      if (!weightOn) return; // tracking was turned off in Profile
      const row = getWeightLog(log.id);
      if (!row) return;
      setWeightInput(String(row.weight));
      setLogDate(new Date(row.logged_at));
    } else if (log.kind === 'supplement') {
      const row = getSupplementLog(log.id);
      if (!row) return;
      // Legacy free-text logs (or ones whose supplement was deleted) have no
      // live profile entry — the user just picks again.
      dispatchSel({
        type: 'load-selection',
        medIds: [],
        suppIds: row.supplement_id != null ? [row.supplement_id] : [],
        medQty: {},
        suppQty: row.supplement_id != null ? { [row.supplement_id]: row.quantity ?? 1 } : {},
      });
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

  return {
    segment,
    visibleSegments,
    selectSegment,
    todayLogs,
    medications,
    profileSupps,
    mealName,
    setMealName,
    mealType,
    setMealType,
    mealNotes,
    setMealNotes,
    sel,
    editingKind,
    onToggleMed,
    onToggleSupp,
    bumpQty,
    symptomName,
    setSymptomName,
    severity,
    setSeverity,
    symptomNotes,
    setSymptomNotes,
    weightInput,
    setWeightInput,
    logDate,
    setLogDate,
    editing,
    saveMeal,
    saveMedSupp,
    saveSymptom,
    saveWeight,
    resetForm,
    startEdit,
    confirmDelete,
  };
}
