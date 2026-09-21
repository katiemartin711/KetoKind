// Export payload for the AI Coach tab: profile + last-30-day summary.
import { database } from './client';
import { getProfile } from './profile';
import { listAllergies, listConditions, listMedications, listSupplements } from './catalog';
import { getDayBounds } from './logs';
import type {
  Allergy,
  Condition,
  FoodLog,
  MedLog,
  Medication,
  Profile,
  Supplement,
  SupplementLog,
  SymptomLog,
  WeightLog,
} from '../types';

export interface ExportData {
  profile: Profile;
  allergies: Allergy[];
  conditions: Condition[];
  medications: Medication[];
  supplements: Supplement[];
  /** Per-type counts for the trailing 30 local days. */
  counts30: { meals: number; medsTaken: number; symptoms: number; supplements: number };
  recentMeals: FoodLog[];
  recentSymptoms: SymptomLog[];
  recentSupplements: SupplementLog[];
  /** Med doses with the name snapshot (aliased like the old join for display). */
  recentMeds: (Omit<MedLog, 'name'> & { medication_name: string })[];
  rangeLabel: string;
}

/** Everything the AI context file needs: profile + last-30-day summary. */
export function getExportData(): ExportData {
  const profile = getProfile();
  const allergies = listAllergies();
  const conditions = listConditions();
  const medications = listMedications();

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29); // trailing 30 days inclusive
  const { start: startIso } = getDayBounds(start);
  const { end: endIso } = getDayBounds(end);

  const countRange = (table: string, col: string) =>
    database().getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} BETWEEN ? AND ?`,
      [startIso, endIso],
    )?.n ?? 0;

  const rangeLabel = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

  return {
    profile,
    allergies,
    conditions,
    medications,
    supplements: listSupplements(),
    counts30: {
      meals: countRange('food_logs', 'logged_at'),
      medsTaken: countRange('med_logs', 'taken_at'),
      symptoms: countRange('symptom_logs', 'logged_at'),
      supplements: countRange('supplement_logs', 'logged_at'),
    },
    recentMeals: database().getAllSync<FoodLog>(
      'SELECT * FROM food_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC LIMIT 40',
      [startIso, endIso],
    ),
    recentSymptoms: database().getAllSync<SymptomLog>(
      'SELECT * FROM symptom_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC LIMIT 40',
      [startIso, endIso],
    ),
    recentSupplements: database().getAllSync<SupplementLog>(
      'SELECT * FROM supplement_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC LIMIT 40',
      [startIso, endIso],
    ),
    recentMeds: database().getAllSync<Omit<MedLog, 'name'> & { medication_name: string }>(
      `SELECT med_logs.id, med_logs.medication_id, med_logs.name AS medication_name, med_logs.taken_at, med_logs.quantity
       FROM med_logs
       WHERE taken_at BETWEEN ? AND ? ORDER BY taken_at DESC LIMIT 60`,
      [startIso, endIso],
    ),
    rangeLabel,
  };
}
