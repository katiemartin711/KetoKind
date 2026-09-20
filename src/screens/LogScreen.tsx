// Log tab: segmented forms for Meal / Medication / Symptom / Supplement,
// plus today's entries across all types with delete on each.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  addFoodLog,
  addMedLog,
  addSupplementLog,
  addSymptomLog,
  deleteLog,
  getLogsForDay,
  listMedications,
} from '../db';
import type { AnyLog, LogSegment, Medication, RootTabParamList } from '../types';
import { COLORS, common } from '../theme';

type LogRoute = RouteProp<RootTabParamList, 'Log'>;

const SEGMENTS: { key: LogSegment; label: string }[] = [
  { key: 'meal', label: 'Meal' },
  { key: 'medication', label: 'Medication' },
  { key: 'symptom', label: 'Symptom' },
  { key: 'supplement', label: 'Supplement' },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const KIND_LABEL: Record<AnyLog['kind'], string> = {
  meal: 'Meal',
  medication: 'Medication',
  symptom: 'Symptom',
  supplement: 'Supplement',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function LogScreen() {
  const route = useRoute<LogRoute>();
  const [segment, setSegment] = useState<LogSegment>('meal');
  const [todayLogs, setTodayLogs] = useState<AnyLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);

  // Form state
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState('Dinner');
  const [mealNotes, setMealNotes] = useState('');
  const [selectedMedId, setSelectedMedId] = useState<number | null>(null);
  const [symptomName, setSymptomName] = useState('');
  const [severity, setSeverity] = useState(3);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [suppName, setSuppName] = useState('');
  const [suppNotes, setSuppNotes] = useState('');

  const refresh = useCallback(() => {
    setTodayLogs(getLogsForDay(new Date()));
    const meds = listMedications();
    setMedications(meds);
    if (selectedMedId != null && !meds.some((m) => m.id === selectedMedId)) {
      setSelectedMedId(null);
    }
  }, [selectedMedId]);

  useFocusEffect(refresh);

  // Dashboard quick-add buttons navigate here with a segment param.
  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  const saveMeal = () => {
    if (!mealName.trim()) return Alert.alert('Missing name', 'What did you eat?');
    addFoodLog(mealName, mealType, mealNotes);
    setMealName('');
    setMealNotes('');
    refresh();
  };

  const saveMed = () => {
    if (selectedMedId == null) return Alert.alert('Nothing selected', 'Pick a medication first.');
    addMedLog(selectedMedId);
    refresh();
  };

  const saveSymptom = () => {
    if (!symptomName.trim()) return Alert.alert('Missing name', 'What symptom are you logging?');
    addSymptomLog(symptomName, severity, symptomNotes);
    setSymptomName('');
    setSymptomNotes('');
    setSeverity(3);
    refresh();
  };

  const saveSupplement = () => {
    if (!suppName.trim()) return Alert.alert('Missing name', 'Which supplement did you take?');
    addSupplementLog(suppName, suppNotes);
    setSuppName('');
    setSuppNotes('');
    refresh();
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
    <View style={common.screen}>
      <ScrollView contentContainerStyle={common.scroll} keyboardShouldPersistTaps="handled">
        <Text style={common.h1}>Log</Text>
        <Text style={common.subtitle}>What did you eat, take, or feel?</Text>

        {/* Segmented control */}
        <View style={styles.segments}>
          {SEGMENTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.segment, segment === s.key && styles.segmentActive]}
              onPress={() => setSegment(s.key)}
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
            <TouchableOpacity style={common.primaryButton} onPress={saveMeal}>
              <Text style={common.primaryButtonText}>Save meal</Text>
            </TouchableOpacity>
          </View>
        )}

        {segment === 'medication' && (
          <View style={common.card}>
            <Text style={common.label}>Which medication?</Text>
            {medications.length === 0 ? (
              <Text style={styles.hint}>
                No medications yet — add them on the Profile tab first.
              </Text>
            ) : (
              <View style={styles.chips}>
                {medications.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.chip, selectedMedId === m.id && styles.chipActive]}
                    onPress={() => setSelectedMedId(m.id)}
                  >
                    <Text style={[styles.chipText, selectedMedId === m.id && styles.chipTextActive]}>
                      {m.name}
                      {m.dosage ? ` (${m.dosage})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[common.primaryButton, medications.length === 0 && styles.disabled]}
              onPress={saveMed}
              disabled={medications.length === 0}
            >
              <Text style={common.primaryButtonText}>Mark as taken</Text>
            </TouchableOpacity>
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
            <TouchableOpacity style={common.primaryButton} onPress={saveSymptom}>
              <Text style={common.primaryButtonText}>Save symptom</Text>
            </TouchableOpacity>
          </View>
        )}

        {segment === 'supplement' && (
          <View style={common.card}>
            <Text style={common.label}>Supplement</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Magnesium, beef liver capsules"
              value={suppName}
              onChangeText={setSuppName}
            />
            <Text style={common.label}>Notes (optional)</Text>
            <TextInput
              style={common.input}
              placeholder="Dose, timing, ..."
              value={suppNotes}
              onChangeText={setSuppNotes}
            />
            <TouchableOpacity style={common.primaryButton} onPress={saveSupplement}>
              <Text style={common.primaryButtonText}>Save supplement</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[common.h2, { marginTop: 12 }]}>Today's entries</Text>
        {todayLogs.length === 0 && <Text style={styles.hint}>Nothing logged yet today.</Text>}
        {todayLogs.map((log) => (
          <View key={`${log.kind}-${log.id}`} style={[common.card, styles.entryRow]}>
            <View style={styles.entryText}>
              <Text style={styles.entryTitle}>
                {log.title} <Text style={styles.entryKind}>· {KIND_LABEL[log.kind]}</Text>
              </Text>
              <Text style={styles.entryDetail}>
                {fmtTime(log.logged_at)}
                {log.detail ? ` — ${log.detail}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(log)} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
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
  chipText: { fontSize: 14, color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { fontSize: 14, color: COLORS.muted, marginVertical: 8 },
  disabled: { opacity: 0.5 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  entryText: { flex: 1 },
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
