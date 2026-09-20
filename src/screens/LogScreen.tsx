// Log tab: segmented forms for Meal / Medication / Symptom / Supplement,
// plus today's entries across all types with delete on each.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
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
import { COLORS, common } from '../theme';
import KeyboardScrollView from '../components/KeyboardScrollView';

type LogRoute = RouteProp<RootTabParamList, 'Log'>;

const SEGMENTS: { key: LogSegment; label: string }[] = [
  { key: 'meal', label: 'Meal' },
  { key: 'medsupp', label: 'Meds & Supps' },
  { key: 'symptom', label: 'Symptom' },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const KIND_LABEL: Record<AnyLog['kind'], string> = {
  meal: 'Meal',
  medication: 'Medication',
  symptom: 'Symptom',
  supplement: 'Supplement',
  weight: 'Weight',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtDateTime(date: Date): string {
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** A "Time" field for the log forms: shows the chosen date/time, taps open a
 *  native picker (dialog on Android, inline on iOS). Future times are blocked. */
function DateTimeField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text style={common.label}>Time</Text>
      <TouchableOpacity style={common.input} onPress={() => setOpen(true)}>
        <Text style={{ fontSize: 16, color: COLORS.text }}>{fmtDateTime(value)}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            mode="datetime"
            value={value}
            maximumDate={new Date()}
            onChange={(event, date) => {
              if (event.type === 'dismissed') {
                setOpen(false);
                return;
              }
              if (date) onChange(date);
              // Android's dialog presentation: close once a value is picked.
              if (Platform.OS === 'android') setOpen(false);
            }}
            onDismiss={() => setOpen(false)}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={common.secondaryButton} onPress={() => setOpen(false)}>
              <Text style={common.secondaryButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

/** Stepper row for "how many did you take" on an as-needed item. */
function QtyRow({
  name,
  qty,
  onDec,
  onInc,
}: {
  name: string;
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.qtyRow}>
      <Text style={styles.qtyName}>{name}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{qty}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LogScreen() {
  const route = useRoute<LogRoute>();
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

  const editingMedSupp =
    editing?.kind === 'medication' || editing?.kind === 'supplement' ? editing.kind : null;
  const medSuppSelected = selectedMedIds.length + selectedSuppIds.length > 0;
  // Selected as-needed items get a "how many" stepper below the chips.
  const asNeededMedSel = medications.filter((m) => m.as_needed && selectedMedIds.includes(m.id));
  const asNeededSuppSel = profileSupps.filter((s) => s.as_needed && selectedSuppIds.includes(s.id));

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
      setSelectedMedIds([row.medication_id]);
      setSelectedSuppIds([]);
      setMedQty({ [row.medication_id]: row.quantity ?? 1 });
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
          <View style={common.card}>
            <Text style={common.label}>What did you eat?</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Ribeye steak, 3 eggs"
              value={mealName}
              onChangeText={setMealName}
            />
            <Text style={common.label}>Meal</Text>
            <View style={styles.chips}>
              {MEAL_TYPES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, mealType === m && styles.chipActive]}
                  onPress={() => setMealType(m)}
                >
                  <Text style={[styles.chipText, mealType === m && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={common.label}>Notes (optional)</Text>
            <TextInput
              style={common.input}
              placeholder="How was it?"
              value={mealNotes}
              onChangeText={setMealNotes}
            />
            <DateTimeField value={logDate} onChange={setLogDate} />
            <TouchableOpacity style={common.primaryButton} onPress={saveMeal}>
              <Text style={common.primaryButtonText}>
                {editing?.kind === 'meal' ? 'Save changes' : 'Save meal'}
              </Text>
            </TouchableOpacity>
            {editing?.kind === 'meal' && (
              <TouchableOpacity style={common.secondaryButton} onPress={resetForm}>
                <Text style={common.secondaryButtonText}>Cancel editing</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {segment === 'medsupp' && (
          <View style={common.card}>
            <Text style={common.label}>Medications — tap all you took</Text>
            {medications.length === 0 ? (
              <Text style={styles.hint}>
                No medications yet — add them on the Profile tab first.
              </Text>
            ) : (
              <View style={styles.chips}>
                {medications.map((m) => {
                  const selected = selectedMedIds.includes(m.id);
                  const locked = editingMedSupp === 'supplement';
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
              <Text style={styles.hint}>
                No supplements yet — add them on the Profile tab first.
              </Text>
            ) : (
              <View style={styles.chips}>
                {profileSupps.map((s) => {
                  const selected = selectedSuppIds.includes(s.id);
                  const locked = editingMedSupp === 'medication';
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
            <DateTimeField value={logDate} onChange={setLogDate} />
            {(asNeededMedSel.length > 0 || asNeededSuppSel.length > 0) && (
              <>
                <Text style={[common.label, { marginTop: 4 }]}>How many?</Text>
                {asNeededMedSel.map((m) => (
                  <QtyRow
                    key={`m${m.id}`}
                    name={m.name}
                    qty={medQty[m.id] ?? 1}
                    onDec={() => bumpQty('med', m.id, -1)}
                    onInc={() => bumpQty('med', m.id, 1)}
                  />
                ))}
                {asNeededSuppSel.map((s) => (
                  <QtyRow
                    key={`s${s.id}`}
                    name={s.name}
                    qty={suppQty[s.id] ?? 1}
                    onDec={() => bumpQty('supp', s.id, -1)}
                    onInc={() => bumpQty('supp', s.id, 1)}
                  />
                ))}
              </>
            )}
            <TouchableOpacity
              style={[common.primaryButton, !medSuppSelected && styles.disabled]}
              onPress={saveMedSupp}
              disabled={!medSuppSelected}
            >
              <Text style={common.primaryButtonText}>
                {editingMedSupp ? 'Save changes' : 'Mark selected as taken'}
              </Text>
            </TouchableOpacity>
            {editingMedSupp && (
              <TouchableOpacity style={common.secondaryButton} onPress={resetForm}>
                <Text style={common.secondaryButtonText}>Cancel editing</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {segment === 'symptom' && (
          <View style={common.card}>
            <Text style={common.label}>Symptom</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Bloating, headache, low energy"
              value={symptomName}
              onChangeText={setSymptomName}
            />
            <Text style={common.label}>Severity: {severity}/5</Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, severity === n && styles.chipActive]}
                  onPress={() => setSeverity(n)}
                >
                  <Text style={[styles.chipText, severity === n && styles.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={common.label}>Notes (optional)</Text>
            <TextInput
              style={common.input}
              placeholder="Anything notable?"
              value={symptomNotes}
              onChangeText={setSymptomNotes}
            />
            <DateTimeField value={logDate} onChange={setLogDate} />
            <TouchableOpacity style={common.primaryButton} onPress={saveSymptom}>
              <Text style={common.primaryButtonText}>
                {editing?.kind === 'symptom' ? 'Save changes' : 'Save symptom'}
              </Text>
            </TouchableOpacity>
            {editing?.kind === 'symptom' && (
              <TouchableOpacity style={common.secondaryButton} onPress={resetForm}>
                <Text style={common.secondaryButtonText}>Cancel editing</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {segment === 'weight' && (
          <View style={common.card}>
            <Text style={common.label}>Weight (lbs)</Text>
            <TextInput
              style={common.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 182.5"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <DateTimeField value={logDate} onChange={setLogDate} />
            <TouchableOpacity style={common.primaryButton} onPress={saveWeight}>
              <Text style={common.primaryButtonText}>
                {editing?.kind === 'weight' ? 'Save changes' : 'Save weight'}
              </Text>
            </TouchableOpacity>
            {editing?.kind === 'weight' && (
              <TouchableOpacity style={common.secondaryButton} onPress={resetForm}>
                <Text style={common.secondaryButtonText}>Cancel editing</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={[common.h2, { marginTop: 12 }]}>Today's entries</Text>
        {todayLogs.length === 0 ? (
          <Text style={styles.hint}>Nothing logged yet today.</Text>
        ) : (
          <Text style={styles.hint}>Tap an entry to edit it.</Text>
        )}
        {todayLogs.map((log) => (
          <View key={`${log.kind}-${log.id}`} style={[common.card, styles.entryRow]}>
            <TouchableOpacity style={styles.entryText} onPress={() => startEdit(log)}>
              <Text style={styles.entryTitle}>
                {log.title} <Text style={styles.entryKind}>· {KIND_LABEL[log.kind]}</Text>
              </Text>
              <Text style={styles.entryDetail}>
                {fmtTime(log.logged_at)}
                {log.detail ? ` — ${log.detail}` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(log)} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
    </KeyboardScrollView>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
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
  segmentActive: { backgroundColor: COLORS.card },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  segmentTextActive: { color: COLORS.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipLocked: { opacity: 0.4 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  qtyName: { flex: 1, fontSize: 15, color: COLORS.text },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: COLORS.accent, fontWeight: '700' },
  qtyValue: { fontSize: 17, fontWeight: '600', minWidth: 34, textAlign: 'center', color: COLORS.text },
  chipText: { fontSize: 14, color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { fontSize: 14, color: COLORS.muted, marginVertical: 8 },
  disabled: { opacity: 0.5 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  entryText: { flex: 1 },
  pickerWrap: { marginTop: 8 },
  entryTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  entryKind: { fontWeight: '400', color: COLORS.muted, fontSize: 13 },
  entryDetail: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  deleteBtn: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
});
