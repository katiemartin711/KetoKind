// All SQLite access for the Diet Coach app lives here.
// Uses expo-sqlite's synchronous API. Call initDb() once at startup.

import * as SQLite from 'expo-sqlite';
import type {
  Allergy,
  AnyLog,
  Condition,
  DietType,
  FoodLog,
  Medication,
  MedLog,
  Profile,
  SupplementLog,
  SymptomLog,
} from './types';

const db = SQLite.openDatabaseSync('dietcoach.db');

/** Create tables on first launch and make sure the single profile row exists. */
export function initDb(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      diet_type TEXT NOT NULL DEFAULT 'carnivore',
      diet_nuances TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      times_per_day INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'Meal',
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS med_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      taken_at TEXT NOT NULL,
      FOREIGN KEY (medication_id) REFERENCES medications(id)
    );
    CREATE TABLE IF NOT EXISTS symptom_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      severity INTEGER NOT NULL DEFAULT 3,
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS supplement_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
  `);
  // Guarantee the single profile row (id = 1) exists.
  const existing = db.getFirstSync<{ id: number }>('SELECT id FROM profile WHERE id = 1');
  if (!existing) {
    db.runSync("INSERT INTO profile (id, diet_type, diet_nuances, goals) VALUES (1, 'carnivore', '', '')");
  }
}

// ---------------------------------------------------------------------------
// Date helpers — day bounds in LOCAL time, returned as ISO strings (UTC).
// Stored timestamps are ISO strings, so range comparisons work directly.
// ---------------------------------------------------------------------------

/** Start/end of the local day containing `date`, as ISO strings. */
export function getDayBounds(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 'YYYY-MM-DD' for a local date — used for streak math. */
function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function getProfile(): Profile {
  const row = db.getFirstSync<Profile>('SELECT * FROM profile WHERE id = 1');
  if (!row) throw new Error('Profile row missing — did initDb() run?');
  return row;
}

export function saveProfile(dietType: DietType, nuances: string, goals: string): void {
  db.runSync('UPDATE profile SET diet_type = ?, diet_nuances = ?, goals = ? WHERE id = 1', [
    dietType,
    nuances,
    goals,
  ]);
}

// ---------------------------------------------------------------------------
// Allergies / conditions / medications (profile lists)
// ---------------------------------------------------------------------------

export function listAllergies(): Allergy[] {
  return db.getAllSync<Allergy>('SELECT * FROM allergies ORDER BY name');
}

export function addAllergy(name: string): void {
  db.runSync('INSERT INTO allergies (name) VALUES (?)', [name.trim()]);
}

export function deleteAllergy(id: number): void {
  db.runSync('DELETE FROM allergies WHERE id = ?', [id]);
}

export function listConditions(): Condition[] {
  return db.getAllSync<Condition>('SELECT * FROM conditions ORDER BY name');
}

export function addCondition(name: string): void {
  db.runSync('INSERT INTO conditions (name) VALUES (?)', [name.trim()]);
}

export function deleteCondition(id: number): void {
  db.runSync('DELETE FROM conditions WHERE id = ?', [id]);
}

export function listMedications(): Medication[] {
  return db.getAllSync<Medication>('SELECT * FROM medications ORDER BY name');
}

export function addMedication(name: string, dosage: string, timesPerDay: number): void {
  db.runSync('INSERT INTO medications (name, dosage, times_per_day) VALUES (?, ?, ?)', [
    name.trim(),
    dosage.trim(),
    timesPerDay,
  ]);
}

export function deleteMedication(id: number): void {
  db.runSync('DELETE FROM medications WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function addFoodLog(name: string, mealType: string, notes: string): void {
  db.runSync('INSERT INTO food_logs (name, meal_type, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    mealType,
    nowIso(),
    notes.trim(),
  ]);
}

export function addMedLog(medicationId: number): void {
  db.runSync('INSERT INTO med_logs (medication_id, taken_at) VALUES (?, ?)', [medicationId, nowIso()]);
}

export function addSymptomLog(name: string, severity: number, notes: string): void {
  db.runSync('INSERT INTO symptom_logs (name, severity, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    severity,
    nowIso(),
    notes.trim(),
  ]);
}

export function addSupplementLog(name: string, notes: string): void {
  db.runSync('INSERT INTO supplement_logs (name, logged_at, notes) VALUES (?, ?, ?)', [
    name.trim(),
    nowIso(),
    notes.trim(),
  ]);
}

export function deleteLog(kind: AnyLog['kind'], id: number): void {
  const table =
    kind === 'meal'
      ? 'food_logs'
      : kind === 'medication'
        ? 'med_logs'
        : kind === 'symptom'
          ? 'symptom_logs'
          : 'supplement_logs';
  db.runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

/** All log entries for one local day, newest first, normalized for display. */
export function getLogsForDay(date: Date): AnyLog[] {
  const { start, end } = getDayBounds(date);
  const meals = db.getAllSync<FoodLog>(
    'SELECT * FROM food_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );
  const meds = db.getAllSync<MedLog>(
    `SELECT med_logs.id, med_logs.medication_id, medications.name AS medication_name, med_logs.taken_at
     FROM med_logs JOIN medications ON medications.id = med_logs.medication_id
     WHERE taken_at BETWEEN ? AND ? ORDER BY taken_at DESC`,
    [start, end],
  );
  const symptoms = db.getAllSync<SymptomLog>(
    'SELECT * FROM symptom_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );
  const supplements = db.getAllSync<SupplementLog>(
    'SELECT * FROM supplement_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );

  const all: AnyLog[] = [
    ...meals.map((m) => ({
      kind: 'meal' as const,
      id: m.id,
      title: m.name,
      detail: m.meal_type + (m.notes ? ` — ${m.notes}` : ''),
      logged_at: m.logged_at,
    })),
    ...meds.map((m) => ({
      kind: 'medication' as const,
      id: m.id,
      title: m.medication_name,
      detail: 'Taken',
      logged_at: m.taken_at,
    })),
    ...symptoms.map((s) => ({
      kind: 'symptom' as const,
      id: s.id,
      title: s.name,
      detail: `Severity ${s.severity}/5` + (s.notes ? ` — ${s.notes}` : ''),
      logged_at: s.logged_at,
    })),
    ...supplements.map((s) => ({
      kind: 'supplement' as const,
      id: s.id,
      title: s.name,
      detail: s.notes || 'Logged',
      logged_at: s.logged_at,
    })),
  ];
  return all.sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1));
}

/** Counts per log type for one local day — feeds the Dashboard cards. */
export function getDayCounts(date: Date): {
  meals: number;
  medsTaken: number;
  medDosesScheduled: number;
  symptoms: number;
  supplements: number;
} {
  const { start, end } = getDayBounds(date);
  const count = (table: string, col: string) =>
    db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} BETWEEN ? AND ?`,
      [start, end],
    )?.n ?? 0;
  const medsTaken = count('med_logs', 'taken_at');
  const medDosesScheduled = listMedications().reduce((sum, m) => sum + m.times_per_day, 0);
  return {
    meals: count('food_logs', 'logged_at'),
    medsTaken,
    medDosesScheduled,
    symptoms: count('symptom_logs', 'logged_at'),
    supplements: count('supplement_logs', 'logged_at'),
  };
}

/**
 * Consecutive-day streak: number of back-to-back local days (ending today or
 * yesterday) that contain at least one log entry of any kind.
 */
export function getStreak(): number {
  const rows = db.getAllSync<{ d: string }>(`
    SELECT DISTINCT date(logged_at, 'localtime') AS d FROM food_logs
    UNION SELECT DISTINCT date(taken_at, 'localtime') FROM med_logs
    UNION SELECT DISTINCT date(logged_at, 'localtime') FROM symptom_logs
    UNION SELECT DISTINCT date(logged_at, 'localtime') FROM supplement_logs
    ORDER BY d DESC
  `);
  const days = new Set(rows.map((r) => r.d));
  let streak = 0;
  const cursor = new Date();
  // A streak stays alive if the most recent logged day is today or yesterday.
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }
  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Export (AI Coach tab)
// ---------------------------------------------------------------------------

export interface ExportData {
  profile: Profile;
  allergies: Allergy[];
  conditions: Condition[];
  medications: Medication[];
  /** Per-type counts for the trailing 30 local days. */
  counts30: { meals: number; medsTaken: number; symptoms: number; supplements: number };
  recentMeals: FoodLog[];
  recentSymptoms: SymptomLog[];
  recentSupplements: SupplementLog[];
  recentMeds: MedLog[];
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
    db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} BETWEEN ? AND ?`,
      [startIso, endIso],
    )?.n ?? 0;

  const rangeLabel = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

  return {
    profile,
    allergies,
    conditions,
    medications,
    counts30: {
      meals: countRange('food_logs', 'logged_at'),
      medsTaken: countRange('med_logs', 'taken_at'),
      symptoms: countRange('symptom_logs', 'logged_at'),
      supplements: countRange('supplement_logs', 'logged_at'),
    },
    recentMeals: db.getAllSync<FoodLog>(
      'SELECT * FROM food_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC LIMIT 40',
      [startIso, endIso],
    ),
    recentSymptoms: db.getAllSync<SymptomLog>(
      'SELECT * FROM symptom_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC LIMIT 40',
      [startIso, endIso],
    ),
    recentSupplements: db.getAllSync<SupplementLog>(
      'SELECT * FROM supplement_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC LIMIT 40',
      [startIso, endIso],
    ),
    recentMeds: db.getAllSync<MedLog>(
      `SELECT med_logs.id, med_logs.medication_id, medications.name AS medication_name, med_logs.taken_at
       FROM med_logs JOIN medications ON medications.id = med_logs.medication_id
       WHERE taken_at BETWEEN ? AND ? ORDER BY taken_at DESC LIMIT 60`,
      [startIso, endIso],
    ),
    rangeLabel,
  };
}
