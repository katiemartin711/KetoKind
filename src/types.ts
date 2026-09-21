// Shared types for the KetoKind app.

import type { ThemeMode } from './theme';

export type DietType = 'keto' | 'carnivore' | 'lion' | 'paleo';

export const DIET_LABELS: Record<DietType, string> = {
  keto: 'Keto',
  carnivore: 'Carnivore',
  lion: 'Lion Diet',
  paleo: 'Paleo',
};

export const DIET_TYPES: DietType[] = ['keto', 'carnivore', 'lion', 'paleo'];

export interface Profile {
  id: number;
  name: string; // '' = not set — what the AI coach should call the user
  diet_type: DietType;
  diet_nuances: string;
  goals: string;
  track_weight: number; // 0/1 — whether weight logging is enabled
  starting_weight: number | null; // lbs
  theme_mode: ThemeMode; // 'system' | 'light' | 'dark'
  age: number | null; // null = not set
  sex: string; // '' = not set, otherwise 'female' | 'male'
  bio: string; // free-text: anything else the AI coach should know
  diet_start: string | null; // 'YYYY-MM' or 'YYYY-MM-DD', null = not set
  dismissed_milestones: string; // comma-separated milestone keys the user dismissed
  is_pro: number; // 0/1 — KetoKind Pro unlock (AI Coach export + backups)
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
  as_needed: number; // 1 = taken as needed, not on a daily schedule
}

/** A recurring supplement from the Profile tab (e.g. Vitamin D3 daily). */
export interface Supplement {
  id: number;
  name: string;
  dosage: string;
  times_per_day: number;
  purpose: string; // what it's for, e.g. "immune support"
  as_needed: number; // 1 = taken as needed, not on a daily schedule
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
  name: string; // snapshot of the medication's name when the dose was logged —
  // history survives renames/deletes on the Profile tab ('' for rows logged
  // before the v2 migration whose medication was already gone)
  taken_at: string; // ISO string
  quantity: number; // how many taken (1 for scheduled doses)
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
  quantity: number; // how many taken (1 for scheduled doses)
}

export interface WeightLog {
  id: number;
  weight: number; // lbs
  logged_at: string; // ISO string
}

/** A log entry of any kind, normalized for the "today" list on the Log tab. */
export type AnyLog =
  | { kind: 'meal'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'medication'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'symptom'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'supplement'; id: number; title: string; detail: string; logged_at: string }
  | { kind: 'weight'; id: number; title: string; detail: string; logged_at: string };

export type LogSegment = 'meal' | 'medsupp' | 'symptom' | 'weight';

/** Bottom-tab routes. The Log tab accepts an optional starting segment
 *  (used by the Dashboard quick-add buttons). */
export type RootTabParamList = {
  Dashboard: undefined;
  Log: { segment?: LogSegment } | undefined;
  Profile: undefined;
  'AI Coach': undefined;
};
