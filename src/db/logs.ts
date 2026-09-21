// Daily logs: food, medications, symptoms, supplements, weight.
// Plus day-bound helpers, per-day rollups, and the logging streak.
import { database } from './client';
import { listMedications } from './catalog';
import type {
  AnyLog,
  FoodLog,
  MedLog,
  SupplementLog,
  SymptomLog,
  WeightLog,
} from '../types';


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

export function addFoodLog(name: string, mealType: string, notes: string, loggedAt: string): void {
  database().runSync('INSERT INTO food_logs (name, meal_type, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    mealType,
    loggedAt,
    notes.trim(),
  ]);
}

export function addMedLog(medicationId: number, takenAt: string, quantity: number = 1): void {
  // Snapshot the name so the dose history survives later renames/deletes.
  const m = database().getFirstSync<{ name: string }>('SELECT name FROM medications WHERE id = ?', [
    medicationId,
  ]);
  database().runSync('INSERT INTO med_logs (medication_id, name, taken_at, quantity) VALUES (?, ?, ?, ?)', [
    medicationId,
    m?.name ?? '',
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
  database().runSync('INSERT INTO symptom_logs (name, severity, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    severity,
    loggedAt,
    notes.trim(),
  ]);
}

export function addSupplementLog(supplementId: number, loggedAt: string, quantity: number = 1): void {
  const s = database().getFirstSync<{ name: string }>('SELECT name FROM supplements WHERE id = ?', [
    supplementId,
  ]);
  database().runSync(
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
  database().runSync('UPDATE food_logs SET name = ?, meal_type = ?, notes = ?, logged_at = ? WHERE id = ?', [
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
  // Re-snapshot the name — the dose now refers to this medication's current name.
  const m = database().getFirstSync<{ name: string }>('SELECT name FROM medications WHERE id = ?', [
    medicationId,
  ]);
  database().runSync('UPDATE med_logs SET medication_id = ?, name = ?, taken_at = ?, quantity = ? WHERE id = ?', [
    medicationId,
    m?.name ?? '',
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
  database().runSync('UPDATE symptom_logs SET name = ?, severity = ?, notes = ?, logged_at = ? WHERE id = ?', [
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
  const s = database().getFirstSync<{ name: string }>('SELECT name FROM supplements WHERE id = ?', [
    supplementId,
  ]);
  database().runSync(
    'UPDATE supplement_logs SET supplement_id = ?, name = ?, logged_at = ?, quantity = ? WHERE id = ?',
    [supplementId, s?.name ?? '', loggedAt, quantity, id],
  );
}

/** Fetch single rows to pre-fill the edit form. */
export function getFoodLog(id: number): FoodLog | null {
  return database().getFirstSync<FoodLog>('SELECT * FROM food_logs WHERE id = ?', [id]);
}

export function getMedLog(id: number): Pick<MedLog, 'id' | 'medication_id' | 'name' | 'taken_at' | 'quantity'> | null {
  return database().getFirstSync<Pick<MedLog, 'id' | 'medication_id' | 'name' | 'taken_at' | 'quantity'>>(
    'SELECT id, medication_id, name, taken_at, quantity FROM med_logs WHERE id = ?',
    [id],
  );
}

export function getSymptomLog(id: number): SymptomLog | null {
  return database().getFirstSync<SymptomLog>('SELECT * FROM symptom_logs WHERE id = ?', [id]);
}

export function getSupplementLog(id: number): SupplementLog | null {
  return database().getFirstSync<SupplementLog>('SELECT * FROM supplement_logs WHERE id = ?', [id]);
}

export function addWeightLog(weight: number, loggedAt: string): void {
  database().runSync('INSERT INTO weight_logs (weight, logged_at) VALUES (?, ?)', [weight, loggedAt]);
}

export function updateWeightLog(id: number, weight: number, loggedAt: string): void {
  database().runSync('UPDATE weight_logs SET weight = ?, logged_at = ? WHERE id = ?', [
    weight,
    loggedAt,
    id,
  ]);
}

export function getWeightLog(id: number): WeightLog | null {
  return database().getFirstSync<WeightLog>('SELECT * FROM weight_logs WHERE id = ?', [id]);
}

/** Most recent weigh-in, or null if none logged yet. */
export function getLatestWeight(): WeightLog | null {
  return database().getFirstSync<WeightLog>('SELECT * FROM weight_logs ORDER BY logged_at DESC LIMIT 1');
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
  database().runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

/** All log entries for one local day, newest first, normalized for display. */
export function getLogsForDay(date: Date): AnyLog[] {
  const { start, end } = getDayBounds(date);
  const meals = database().getAllSync<FoodLog>(
    'SELECT * FROM food_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );
  const meds = database().getAllSync<MedLog>(
    `SELECT id, medication_id, name, taken_at, quantity
     FROM med_logs
     WHERE taken_at BETWEEN ? AND ? ORDER BY taken_at DESC`,
    [start, end],
  );
  const symptoms = database().getAllSync<SymptomLog>(
    'SELECT * FROM symptom_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );
  const supplements = database().getAllSync<SupplementLog>(
    'SELECT * FROM supplement_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );
  const weights = database().getAllSync<WeightLog>(
    'SELECT * FROM weight_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
    [start, end],
  );

  const all: AnyLog[] = [
    ...meals.map(mapMeal),
    ...meds.map(mapMed),
    ...symptoms.map(mapSymptom),
    ...supplements.map(mapSupplement),
    ...weights.map(mapWeight),
  ];
  return all.sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1));
}

function mapMeal(m: FoodLog): AnyLog {
  return {
    kind: 'meal',
    id: m.id,
    title: m.name,
    detail: m.meal_type + (m.notes ? ` — ${m.notes}` : ''),
    logged_at: m.logged_at,
  };
}

function mapMed(m: MedLog): AnyLog {
  return {
    kind: 'medication',
    id: m.id,
    // The snapshot keeps the dose's name even if the medication was renamed
    // or deleted from the profile since; rows from before the v2 migration
    // whose medication was already gone have an empty name.
    title: m.name || 'Deleted medication',
    detail: m.quantity > 1 ? `Took ${m.quantity}` : 'Taken',
    logged_at: m.taken_at,
  };
}

function mapSymptom(s: SymptomLog): AnyLog {
  return {
    kind: 'symptom',
    id: s.id,
    title: s.name,
    detail: `Severity ${s.severity}/5` + (s.notes ? ` — ${s.notes}` : ''),
    logged_at: s.logged_at,
  };
}

function mapSupplement(s: SupplementLog): AnyLog {
  return {
    kind: 'supplement',
    id: s.id,
    title: s.name,
    detail: s.quantity > 1 ? `Took ${s.quantity}` : s.notes || 'Logged',
    logged_at: s.logged_at,
  };
}

function mapWeight(w: WeightLog): AnyLog {
  return {
    kind: 'weight',
    id: w.id,
    title: `${w.weight} lbs`,
    detail: 'Weigh-in',
    logged_at: w.logged_at,
  };
}

const KIND_QUERIES: Record<AnyLog['kind'], { sql: string; map: (row: any) => AnyLog }> = {
  meal: { sql: 'SELECT * FROM food_logs ORDER BY logged_at DESC', map: mapMeal },
  medication: {
    sql: 'SELECT id, medication_id, name, taken_at, quantity FROM med_logs ORDER BY taken_at DESC',
    map: mapMed,
  },
  symptom: { sql: 'SELECT * FROM symptom_logs ORDER BY logged_at DESC', map: mapSymptom },
  supplement: { sql: 'SELECT * FROM supplement_logs ORDER BY logged_at DESC', map: mapSupplement },
  weight: { sql: 'SELECT * FROM weight_logs ORDER BY logged_at DESC', map: mapWeight },
};

/** Every log of one kind, newest first, normalized for display. */
export function getLogsOfKind(kind: AnyLog['kind']): AnyLog[] {
  const q = KIND_QUERIES[kind];
  return (database().getAllSync(q.sql) as any[]).map(q.map);
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
    database().getFirstSync<{ n: number }>(
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
  const rows = database().getAllSync<{ d: string }>(`
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
