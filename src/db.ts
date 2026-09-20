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
  Supplement,
  SupplementLog,
  SymptomLog,
  WeightLog,
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
      goals TEXT NOT NULL DEFAULT '',
      theme_mode TEXT NOT NULL DEFAULT 'system'
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
      times_per_day INTEGER NOT NULL DEFAULT 1,
      purpose TEXT NOT NULL DEFAULT '',
      as_needed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS supplements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      times_per_day INTEGER NOT NULL DEFAULT 1,
      purpose TEXT NOT NULL DEFAULT '',
      as_needed INTEGER NOT NULL DEFAULT 0
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
      quantity INTEGER NOT NULL DEFAULT 1,
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
      supplement_id INTEGER,
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL NOT NULL,
      logged_at TEXT NOT NULL
    );
  `);
  // Guarantee the single profile row (id = 1) exists.
  const existing = db.getFirstSync<{ id: number }>('SELECT id FROM profile WHERE id = 1');
  if (!existing) {
    db.runSync("INSERT INTO profile (id, diet_type, diet_nuances, goals) VALUES (1, 'carnivore', '', '')");
  }
  // Column migrations for tables that already existed before the column did.
  addColumnIfMissing('medications', 'purpose', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('supplements', 'purpose', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('medications', 'as_needed', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('supplements', 'as_needed', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('profile', 'track_weight', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('profile', 'starting_weight', 'REAL');
  addColumnIfMissing('med_logs', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('supplement_logs', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('profile', 'theme_mode', "TEXT NOT NULL DEFAULT 'system'");
  addColumnIfMissing('profile', 'age', 'INTEGER');
  addColumnIfMissing('profile', 'sex', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('profile', 'bio', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('profile', 'diet_start', 'TEXT');
  addColumnIfMissing('profile', 'dismissed_milestones', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('supplement_logs', 'supplement_id', 'INTEGER');
  // Backfill supplement_id for logs saved before the tap-to-log picker existed.
  const legacySuppLogs = db.getAllSync<{ id: number; name: string }>(
    'SELECT id, name FROM supplement_logs WHERE supplement_id IS NULL',
  );
  for (const row of legacySuppLogs) {
    const match = db.getFirstSync<{ id: number }>(
      'SELECT id FROM supplements WHERE lower(trim(name)) = lower(trim(?))',
      [row.name],
    );
    if (match) {
      db.runSync('UPDATE supplement_logs SET supplement_id = ? WHERE id = ?', [match.id, row.id]);
    }
  }
}

/** ALTER TABLE ... ADD COLUMN, but only when the column isn't there yet. */
function addColumnIfMissing(table: string, column: string, definition: string): void {
  const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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

export function saveProfile(
  dietType: DietType,
  nuances: string,
  goals: string,
  age: number | null,
  sex: string,
  bio: string,
  dietStart: string | null,
): void {
  db.runSync(
    'UPDATE profile SET diet_type = ?, diet_nuances = ?, goals = ?, age = ?, sex = ?, bio = ?, diet_start = ? WHERE id = 1',
    [dietType, nuances, goals, age, sex, bio, dietStart],
  );
}

/** Milestone keys (e.g. 'd30', 'y1') the user already dismissed. */
export function getDismissedMilestones(): string[] {
  const row = db.getFirstSync<{ dismissed_milestones: string }>(
    'SELECT dismissed_milestones FROM profile WHERE id = 1',
  );
  const raw = row?.dismissed_milestones ?? '';
  return raw ? raw.split(',').filter(Boolean) : [];
}

/** True once the user has filled in anything meaningful on the Profile tab
 *  (age, sex, bio, goals, nuances, or diet start date). Used to nudge brand-new
 *  users toward setup on the Dashboard. */
export function isProfileSetup(p: Profile): boolean {
  return (
    p.age != null ||
    p.sex !== '' ||
    p.bio.trim() !== '' ||
    p.goals.trim() !== '' ||
    p.diet_nuances.trim() !== '' ||
    p.diet_start != null
  );
}

/** Remember that the user dismissed milestone banners so they stay gone.
 *  Pass every reached milestone's key — dismissing the newest banner also
 *  clears older ones so they never pop back up. */
export function dismissMilestones(keys: string[]): void {
  const current = getDismissedMilestones();
  const merged = [...current];
  for (const k of keys) {
    if (!merged.includes(k)) merged.push(k);
  }
  db.runSync('UPDATE profile SET dismissed_milestones = ? WHERE id = 1', [merged.join(',')]);
}

/** Remember that the user dismissed a milestone banner so it stays gone. */
export function dismissMilestone(key: string): void {
  dismissMilestones([key]);
}

/** Persist just the diet type — auto-saved the moment the user taps an option. */
export function persistDietType(dietType: DietType): void {
  db.runSync('UPDATE profile SET diet_type = ? WHERE id = 1', [dietType]);
}

/** Weight-tracking preference + starting weight (lbs, null when unset). */
export function setWeightTracking(trackWeight: boolean, startingWeight: number | null): void {
  db.runSync('UPDATE profile SET track_weight = ?, starting_weight = ? WHERE id = 1', [
    trackWeight ? 1 : 0,
    startingWeight,
  ]);
}

import type { ThemeMode } from './theme';

/** 'system' (default) follows the phone's light/dark setting. */
export function getThemeMode(): ThemeMode {
  const row = db.getFirstSync<{ theme_mode: string }>('SELECT theme_mode FROM profile WHERE id = 1');
  const m = row?.theme_mode;
  return m === 'light' || m === 'dark' ? m : 'system';
}

export function setThemeMode(mode: ThemeMode): void {
  db.runSync('UPDATE profile SET theme_mode = ? WHERE id = 1', [mode]);
}

// ---------------------------------------------------------------------------
// Allergies / conditions / medications / supplements (profile lists)
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

export function addMedication(
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  db.runSync(
    'INSERT INTO medications (name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0],
  );
}

export function deleteMedication(id: number): void {
  db.runSync('DELETE FROM medications WHERE id = ?', [id]);
}

export function updateMedication(
  id: number,
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  db.runSync(
    'UPDATE medications SET name = ?, dosage = ?, times_per_day = ?, purpose = ?, as_needed = ? WHERE id = ?',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0, id],
  );
}

export function listSupplements(): Supplement[] {
  return db.getAllSync<Supplement>('SELECT * FROM supplements ORDER BY name');
}

export function addSupplement(
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  db.runSync(
    'INSERT INTO supplements (name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0],
  );
}

export function deleteSupplement(id: number): void {
  db.runSync('DELETE FROM supplements WHERE id = ?', [id]);
}

export function updateSupplement(
  id: number,
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  db.runSync(
    'UPDATE supplements SET name = ?, dosage = ?, times_per_day = ?, purpose = ?, as_needed = ? WHERE id = ?',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0, id],
  );
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function addFoodLog(name: string, mealType: string, notes: string, loggedAt: string): void {
  db.runSync('INSERT INTO food_logs (name, meal_type, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    mealType,
    loggedAt,
    notes.trim(),
  ]);
}

export function addMedLog(medicationId: number, takenAt: string, quantity: number = 1): void {
  db.runSync('INSERT INTO med_logs (medication_id, taken_at, quantity) VALUES (?, ?, ?)', [
    medicationId,
    takenAt,
    quantity,
  ]);
}

export function addSymptomLog(
  name: string,
  severity: number,
  notes: string,
  loggedAt: string,
): void {
  db.runSync('INSERT INTO symptom_logs (name, severity, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    severity,
    loggedAt,
    notes.trim(),
  ]);
}

export function addSupplementLog(supplementId: number, loggedAt: string, quantity: number = 1): void {
  const s = db.getFirstSync<{ name: string }>('SELECT name FROM supplements WHERE id = ?', [
    supplementId,
  ]);
  db.runSync(
    'INSERT INTO supplement_logs (name, supplement_id, logged_at, notes, quantity) VALUES (?, ?, ?, ?, ?)',
    [s?.name ?? '', supplementId, loggedAt, '', quantity],
  );
}

export function updateFoodLog(
  id: number,
  name: string,
  mealType: string,
  notes: string,
  loggedAt: string,
): void {
  db.runSync('UPDATE food_logs SET name = ?, meal_type = ?, notes = ?, logged_at = ? WHERE id = ?', [
    name.trim(),
    mealType,
    notes.trim(),
    loggedAt,
    id,
  ]);
}

export function updateMedLog(
  id: number,
  medicationId: number,
  takenAt: string,
  quantity: number = 1,
): void {
  db.runSync('UPDATE med_logs SET medication_id = ?, taken_at = ?, quantity = ? WHERE id = ?', [
    medicationId,
    takenAt,
    quantity,
    id,
  ]);
}

export function updateSymptomLog(
  id: number,
  name: string,
  severity: number,
  notes: string,
  loggedAt: string,
): void {
  db.runSync('UPDATE symptom_logs SET name = ?, severity = ?, notes = ?, logged_at = ? WHERE id = ?', [
    name.trim(),
    severity,
    notes.trim(),
    loggedAt,
    id,
  ]);
}

export function updateSupplementLog(
  id: number,
  supplementId: number,
  loggedAt: string,
  quantity: number = 1,
): void {
  const s = db.getFirstSync<{ name: string }>('SELECT name FROM supplements WHERE id = ?', [
    supplementId,
  ]);
  db.runSync(
    'UPDATE supplement_logs SET supplement_id = ?, name = ?, logged_at = ?, quantity = ? WHERE id = ?',
    [supplementId, s?.name ?? '', loggedAt, quantity, id],
  );
}

/** Fetch single rows to pre-fill the edit form. */
export function getFoodLog(id: number): FoodLog | null {
  return db.getFirstSync<FoodLog>('SELECT * FROM food_logs WHERE id = ?', [id]);
}

export function getMedLog(id: number): Pick<MedLog, 'id' | 'medication_id' | 'taken_at' | 'quantity'> | null {
  return db.getFirstSync<Pick<MedLog, 'id' | 'medication_id' | 'taken_at' | 'quantity'>>(
    'SELECT id, medication_id, taken_at, quantity FROM med_logs WHERE id = ?',
    [id],
  );
}

export function getSymptomLog(id: number): SymptomLog | null {
  return db.getFirstSync<SymptomLog>('SELECT * FROM symptom_logs WHERE id = ?', [id]);
}

export function getSupplementLog(id: number): SupplementLog | null {
  return db.getFirstSync<SupplementLog>('SELECT * FROM supplement_logs WHERE id = ?', [id]);
}

export function addWeightLog(weight: number, loggedAt: string): void {
  db.runSync('INSERT INTO weight_logs (weight, logged_at) VALUES (?, ?)', [weight, loggedAt]);
}

export function updateWeightLog(id: number, weight: number, loggedAt: string): void {
  db.runSync('UPDATE weight_logs SET weight = ?, logged_at = ? WHERE id = ?', [
    weight,
    loggedAt,
    id,
  ]);
}

export function getWeightLog(id: number): WeightLog | null {
  return db.getFirstSync<WeightLog>('SELECT * FROM weight_logs WHERE id = ?', [id]);
}

/** Most recent weigh-in, or null if none logged yet. */
export function getLatestWeight(): WeightLog | null {
  return db.getFirstSync<WeightLog>('SELECT * FROM weight_logs ORDER BY logged_at DESC LIMIT 1');
}

export function deleteLog(kind: AnyLog['kind'], id: number): void {
  const table =
    kind === 'meal'
      ? 'food_logs'
      : kind === 'medication'
        ? 'med_logs'
        : kind === 'symptom'
          ? 'symptom_logs'
          : kind === 'supplement'
            ? 'supplement_logs'
            : 'weight_logs';
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
    `SELECT med_logs.id, med_logs.medication_id, medications.name AS medication_name, med_logs.taken_at, med_logs.quantity
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
  const weights = db.getAllSync<WeightLog>(
    'SELECT * FROM weight_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
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
      detail: m.quantity > 1 ? `Took ${m.quantity}` : 'Taken',
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
      detail: s.quantity > 1 ? `Took ${s.quantity}` : s.notes || 'Logged',
      logged_at: s.logged_at,
    })),
    ...weights.map((w) => ({
      kind: 'weight' as const,
      id: w.id,
      title: `${w.weight} lbs`,
      detail: 'Weigh-in',
      logged_at: w.logged_at,
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
  // As-needed meds aren't on a daily schedule, so they don't count as
  // scheduled doses (taking one still counts in medsTaken above).
  const medDosesScheduled = listMedications()
    .filter((m) => !m.as_needed)
    .reduce((sum, m) => sum + m.times_per_day, 0);
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
    UNION SELECT DISTINCT date(logged_at, 'localtime') FROM weight_logs
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
  supplements: Supplement[];
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
    supplements: listSupplements(),
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
