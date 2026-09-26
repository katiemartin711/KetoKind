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
  listLoggedSymptomNames,
  updateFoodLog,
  updateMedLog,
  updateSupplementLog,
  setFoodMacros,
  updateSymptomLog,
  updateWeightLog,
} from '../../db/logs';
import { database } from '../../db/client';
import { getLlmOffer, getProfile, getTrackCalories, setLlmOffer } from '../../db/profile';
import { listMedications, listSupplements } from '../../db/catalog';
import { requestReconcileReminders } from '../../reminders';
import { confirmDeleteEntry } from '../../confirmDelete';
import type { AnyLog, LogSegment, MealFavorite, Medication, RootTabParamList, Supplement } from '../../types';
import { parseFloatStrict } from '../../numberParsing';
import { macroFieldsBlank, parseUserMacros } from '../../macros';
import { planMealSave } from '../../llmOffer';
import { ON_DEVICE_MODEL_MB } from '../../llm/model';
import { downloadOnDeviceModel, isModelReady, isNativeLlmLinked } from '../../llm/engine';
import { estimateMealMacros } from '../../foodEstimate';
import { estimateSavedMeal } from '../../llm/tasks';
import {
  deleteMealFavorite,
  deleteMealFavoriteByName,
  findMealFavorite,
  listMealFavorites,
  saveMealFavorite,
  saveMealFavoriteFromLog,
} from '../../db/favorites';
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

function alertSaveFailed(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  Alert.alert("Couldn't save", message || 'Something went wrong while saving. Please try again.');
}

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
  const [macroProtein, setMacroProtein] = useState('');
  const [macroFat, setMacroFat] = useState('');
  const [macroCarbs, setMacroCarbs] = useState('');
  const [macroFiber, setMacroFiber] = useState('');
  const [macroCalories, setMacroCalories] = useState('');
  const [trackCalories, setTrackCalories] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favoriteLabel, setFavoriteLabel] = useState('');
  const [favorites, setFavorites] = useState<MealFavorite[]>([]);
  // Med/supp chip selection + per-item quantities, as one state machine
  // (edit-mode locking lives in the reducer).
  const [sel, dispatchSel] = useReducer(medSuppSelectionReducer, initialMedSuppSelection);
  const [symptomName, setSymptomName] = useState('');
  const [priorSymptomNames, setPriorSymptomNames] = useState<string[]>([]);
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
    setPriorSymptomNames(listLoggedSymptomNames());
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
    setTrackCalories(getTrackCalories());
    setFavorites(listMealFavorites());
    // Keep the "only remind if you haven't logged" schedule truthful: any
    // add/edit/delete changes whether today's nudge should fire.
    requestReconcileReminders();
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

  const macroInput = {
    protein: macroProtein,
    fat: macroFat,
    carbs: macroCarbs,
    fiber: macroFiber,
    calories: macroCalories,
  };

  const saveMeal = () => {
    if (!mealName.trim()) return Alert.alert('Missing name', 'What did you eat?');
    const fieldsBlank = macroFieldsBlank(macroInput, trackCalories);
    let userMacros = null;
    if (!fieldsBlank) {
      const parsed = parseUserMacros(macroInput, trackCalories);
      if (!parsed.ok) return Alert.alert('Check macros', parsed.message);
      userMacros = parsed.macros;
    }
    const previous = editing?.kind === 'meal' ? getFoodLog(editing.id) : null;
    const sameAsSaved =
      previous != null &&
      userMacros != null &&
      previous.protein_g === userMacros.proteinG &&
      previous.fat_g === userMacros.fatG &&
      previous.carbs_g === userMacros.carbsG &&
      previous.fiber_g === userMacros.fiberG &&
      (!trackCalories || (previous.calories ?? null) === userMacros.calories);
    // An untouched estimate should be recalculated. Typed numbers are kept.
    const userEdited = !fieldsBlank && !(sameAsSaved && previous?.macro_source === 'estimated');
    let mealId = 0;
    try {
      const at = logDate.toISOString();
      if (editing?.kind === 'meal') {
        updateFoodLog(editing.id, mealName, mealType, mealNotes, at);
        mealId = editing.id;
      } else {
        mealId = addFoodLog(mealName, mealType, mealNotes, at);
      }
      if (userMacros && userEdited && !sameAsSaved) setFoodMacros(mealId, userMacros, 'edited');
      if (favorite) {
        saveMealFavorite({
          name: mealName,
          mealType,
          notes: mealNotes,
          macros: userMacros,
          source: userMacros && userEdited ? 'edited' : '',
          label: favoriteLabel,
        });
      } else {
        deleteMealFavoriteByName(mealName);
      }
    } catch (e) {
      alertSaveFailed(e);
      return;
    }
    const savedName = mealName;
    const savedNotes = mealNotes;
    const keepFavorite = favorite;
    const plan = estimateMealMacros(savedName, savedNotes)
      ? userEdited
        ? 'save-only'
        : 'estimate'
      : planMealSave({
          modelReady: isModelReady(),
          nativeAvailable: isNativeLlmLinked(),
          offer: getLlmOffer(),
          userEditedMacros: userEdited,
        });
    resetForm();
    refresh();
    if (plan === 'estimate') {
      setEstimating(true);
      void estimateSavedMeal(mealId, savedName, savedNotes)
        .then((ok) => {
          if (keepFavorite && ok) {
            const row = getFoodLog(mealId);
            if (row) saveMealFavoriteFromLog(row);
          }
        })
        .catch(() => false)
        .finally(() => {
          setEstimating(false);
          refresh();
        });
    } else if (plan === 'prompt-download') {
      Alert.alert(
        'Estimate macros on this phone?',
        `A small model (about ${ON_DEVICE_MODEL_MB} MB) downloads once and stays on your device. Your meal is already saved. You can download later from Profile.`,
        [
          { text: 'Not now', onPress: () => setLlmOffer('declined') },
          {
            text: 'Download',
            onPress: () => {
              setEstimating(true);
              void downloadOnDeviceModel()
                .then(() => estimateSavedMeal(mealId, savedName, savedNotes))
                .then((ok) => {
                  if (keepFavorite && ok) {
                    const row = getFoodLog(mealId);
                    if (row) saveMealFavoriteFromLog(row);
                  }
                })
                .catch(() => {
                  Alert.alert(
                    "Couldn't download",
                    'The meal is saved. You can try the download again from Profile.',
                  );
                })
                .finally(() => {
                  setEstimating(false);
                  refresh();
                });
            },
          },
        ],
      );
    }
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
    try {
      const at = logDate.toISOString();
      if (editing?.kind === 'medication' && selectedMedIds.length > 0) {
        updateMedLog(editing.id, selectedMedIds[0], at, medQty[selectedMedIds[0]] ?? 1);
      } else if (editing?.kind === 'supplement' && selectedSuppIds.length > 0) {
        updateSupplementLog(editing.id, selectedSuppIds[0], at, suppQty[selectedSuppIds[0]] ?? 1);
      } else if (!editing) {
        // Multi-insert must be atomic so a crash mid-handful doesn't leave a
        // half-logged set of pills.
        database().withTransactionSync(() => {
          selectedMedIds.forEach((id) => addMedLog(id, at, medQty[id] ?? 1));
          selectedSuppIds.forEach((id) => addSupplementLog(id, at, suppQty[id] ?? 1));
        });
      }
      resetForm();
      refresh();
    } catch (e) {
      alertSaveFailed(e);
    }
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
    try {
      const at = logDate.toISOString();
      if (editing?.kind === 'symptom') {
        updateSymptomLog(editing.id, symptomName, severity, symptomNotes, at);
      } else {
        addSymptomLog(symptomName, severity, symptomNotes, at);
      }
      resetForm();
      refresh();
    } catch (e) {
      alertSaveFailed(e);
    }
  };

  const saveWeight = () => {
    const w = parseFloatStrict(weightInput);
    if (w == null || w <= 0) return Alert.alert('Invalid', 'Enter your weight in lbs.');
    try {
      const at = logDate.toISOString();
      if (editing?.kind === 'weight') {
        updateWeightLog(editing.id, w, at);
      } else {
        addWeightLog(w, at);
      }
      resetForm();
      refresh();
    } catch (e) {
      alertSaveFailed(e);
    }
  };

  /** Clear the form back to a fresh entry. */
  const resetForm = () => {
    setMealName('');
    setMealNotes('');
    setMealType('Dinner');
    setMacroProtein('');
    setMacroFat('');
    setMacroCarbs('');
    setMacroFiber('');
    setMacroCalories('');
    setFavorite(false);
    setFavoriteLabel('');
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
      setMacroProtein(row.protein_g == null ? '' : String(row.protein_g));
      setMacroFat(row.fat_g == null ? '' : String(row.fat_g));
      setMacroCarbs(row.carbs_g == null ? '' : String(row.carbs_g));
      setMacroFiber(row.fiber_g == null ? '' : String(row.fiber_g));
      setMacroCalories(row.calories == null ? '' : String(row.calories));
      const savedFavorite = findMealFavorite(row.name);
      setFavorite(savedFavorite != null);
      setFavoriteLabel(savedFavorite?.label ?? '');
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
    confirmDeleteEntry(log.title, () => {
      try {
        deleteLog(log.kind, log.id);
        refresh();
      } catch (e) {
        alertSaveFailed(e);
      }
    });
  };

  const useFavorite = (id: number) => {
    const fav = favorites.find((row) => row.id === id);
    if (!fav) return;
    setSegment('meal');
    setEditing(null);
    setMealName(fav.name);
    setMealType(fav.meal_type);
    setMealNotes(fav.notes);
    setMacroProtein(fav.protein_g == null ? '' : String(fav.protein_g));
    setMacroFat(fav.fat_g == null ? '' : String(fav.fat_g));
    setMacroCarbs(fav.carbs_g == null ? '' : String(fav.carbs_g));
    setMacroFiber(fav.fiber_g == null ? '' : String(fav.fiber_g));
    setMacroCalories(fav.calories == null ? '' : String(fav.calories));
    setFavorite(true);
    setFavoriteLabel(fav.label);
    setLogDate(new Date());
  };

  const removeFavorite = (id: number) => {
    const fav = favorites.find((row) => row.id === id);
    deleteMealFavorite(id);
    if (fav && fav.name.trim().toLowerCase() === mealName.trim().toLowerCase()) setFavorite(false);
    setFavorites(listMealFavorites());
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
    trackCalories,
    macroProtein,
    setMacroProtein,
    macroFat,
    setMacroFat,
    macroCarbs,
    setMacroCarbs,
    macroFiber,
    setMacroFiber,
    macroCalories,
    setMacroCalories,
    estimating,
    favorite,
    setFavorite,
    favoriteLabel,
    setFavoriteLabel,
    favorites,
    useFavorite,
    removeFavorite,
    sel,
    editingKind,
    onToggleMed,
    onToggleSupp,
    bumpQty,
    symptomName,
    setSymptomName,
    priorSymptomNames,
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
