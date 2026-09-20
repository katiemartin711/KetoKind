// Shared types for the Diet Coach app.

export type DietType = 'keto' | 'carnivore' | 'lion';

export const DIET_LABELS: Record<DietType, string> = {
  keto: 'Keto',
  carnivore: 'Carnivore',
  lion: 'Lion Diet',
};

export const DIET_TYPES: DietType[] = ['keto', 'carnivore', 'lion'];

export interface Profile {
  id: number;
  diet_type: DietType;
  diet_nuances: string;
  goals: string;
}

export interface Allergy {
  id: number;
  name: string;
}

export interface Condition {
  id: number;
  name: string;
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  times_per_day: number;
  purpose: string; // what it's for, e.g. "blood sugar"
}

/** A recurring supplement from the Profile tab (e.g. Vitamin D3 daily). */
export interface Supplement {
  id: number;
  name: string;
  dosage: string;
  times_per_day: number;
  purpose: string; // what it's for, e.g. "immune support"
}

export interface FoodLog {
  id: number;
  name: string;
  meal_type: string;
  logged_at: string; // ISO string
  notes: string;
}

export interface MedLog {
  id: number;
  medication_id: number;
  medication_name: string; // joined from medications table
  taken_at: string; // ISO string
}

export interface SymptomLog {
  id: number;
  name: string;
  severity: number; // 1-5
  logged_at: string; // ISO string
  notes: string;
}

export interface SupplementLog {
  id: number;
  name: string; // snapshot of the supplement's name when logged
  /** Link to the profile supplements list; null for legacy free-text logs. */
  supplement_id: number | null;
  logged_at: string; // ISO string
  notes: string;
}

/** A log entry of any kind, normalized for the "today" list on the Log tab. */
export type AnyLog =
  | { kind: 'meal'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'medication'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'symptom'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'supplement'; id: number; title: string; detail: string; logged_at: string };

export type LogSegment = 'meal' | 'medication' | 'symptom' | 'supplement';

/** Bottom-tab routes. The Log tab accepts an optional starting segment
 *  (used by the Dashboard quick-add buttons). */
export type RootTabParamList = {
  Dashboard: undefined;
  Log: { segment?: LogSegment } | undefined;
  Profile: undefined;
  'AI Coach': undefined;
};
