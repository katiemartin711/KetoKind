// Full backup / restore (device switching): export, deep validation, import.
// validateBackup() is pure — run it BEFORE touching any data.
import { database } from './client';
import { getProfile } from './profile';
import { listAllergies, listConditions, listMedications, listSupplements } from './catalog';
import type {
  Allergy,
  Condition,
  DietType,
  FoodLog,
  Medication,
  Profile,
  Supplement,
  SupplementLog,
  SymptomLog,
  WeightLog,
} from '../types';
import type { ThemeMode } from '../theme';
import { parseDietStart } from '../milestones';

/** Everything stored on-device, in one JSON-serializable object. */
export interface DatabaseBackup {
  version: 1;
  exportedAt: string; // ISO timestamp
  profile: Profile;
  allergies: Allergy[];
  conditions: Condition[];
  medications: Medication[];
  supplements: Supplement[];
  foodLogs: FoodLog[];
  /** Raw med log rows (no joined medication name — the link is medication_id). */
  medLogs: Array<{ id: number; medication_id: number; taken_at: string; quantity: number }>;
  symptomLogs: SymptomLog[];
  supplementLogs: SupplementLog[];
  weightLogs: WeightLog[];
}

/** Snapshot every table for backup. */
export function exportBackup(): DatabaseBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: getProfile(),
    allergies: listAllergies(),
    conditions: listConditions(),
    medications: listMedications(),
    supplements: listSupplements(),
    foodLogs: database().getAllSync<FoodLog>('SELECT * FROM food_logs ORDER BY id'),
    medLogs: database().getAllSync<DatabaseBackup['medLogs'][number]>(
      'SELECT id, medication_id, taken_at, quantity FROM med_logs ORDER BY id',
    ),
    symptomLogs: database().getAllSync<SymptomLog>('SELECT * FROM symptom_logs ORDER BY id'),
    supplementLogs: database().getAllSync<SupplementLog>('SELECT * FROM supplement_logs ORDER BY id'),
    weightLogs: database().getAllSync<WeightLog>('SELECT * FROM weight_logs ORDER BY id'),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * One problem found by validateBackup(). `path` locates the offending value,
 * e.g. "medLogs[3].quantity".
 */
export interface BackupIssue {
  path: string;
  message: string;
}

/** SQLite AUTOINCREMENT ids are positive integers (1, 2, 3, ...). */
function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

/** 0/1 flags as stored (booleans are tolerated; anything else is junk). */
function isFlag(v: unknown): boolean {
  return v === 0 || v === 1 || v === true || v === false;
}

/** Plausible human weight in lbs. */
function isWeight(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 2000;
}

/**
 * Full ISO-8601 datetimes — the only timestamp format this app writes
 * (Date.toISOString(), e.g. '2026-09-21T02:24:30.995Z'). Impossible calendar
 * dates like '2024-02-30' are rejected explicitly (V8's Date.parse rolls them
 * over to March instead of returning NaN).
 */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/;
function isIsoDateTime(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATETIME_RE.test(v)) return false;
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return false;
  }
  return !Number.isNaN(Date.parse(v));
}

/**
 * Deep validation of a parsed backup: structure, duplicate ids, dates,
 * dangling relationships, and numeric ranges. Pure — run it BEFORE touching
 * any data: a wrong or tampered file must abort the import, never wipe the
 * device. Returns every issue found ([] means the backup is valid).
 */
export function validateBackup(value: unknown): BackupIssue[] {
  const issues: BackupIssue[] = [];
  const at = (path: string, message: string): void => {
    issues.push({ path, message });
  };
  const expectString = (row: Record<string, unknown>, key: string, path: string): void => {
    if (typeof row[key] !== 'string') at(`${path}.${key}`, 'must be a string');
  };
  const expectTimestamp = (row: Record<string, unknown>, key: string, path: string): void => {
    if (!isIsoDateTime(row[key])) at(`${path}.${key}`, 'must be an ISO-8601 timestamp');
  };
  const expectQuantity = (row: Record<string, unknown>, key: string, path: string): void => {
    if (!isPositiveInt(row[key])) at(`${path}.${key}`, 'must be a positive integer');
  };

  if (!isRecord(value)) {
    at('(root)', 'backup must be a JSON object');
    return issues;
  }
  if (value.version !== 1) at('version', 'unsupported backup version (expected 1)');
  if (!isIsoDateTime(value.exportedAt)) at('exportedAt', 'must be an ISO-8601 timestamp');

  // -- profile ------------------------------------------------------------
  const p = value.profile;
  if (!isRecord(p)) {
    at('profile', 'must be an object');
  } else {
    if (p.id !== 1) at('profile.id', 'must be 1');
    if (p.diet_type !== 'keto' && p.diet_type !== 'carnivore' && p.diet_type !== 'lion' && p.diet_type !== 'paleo') {
      at('profile.diet_type', "must be 'keto', 'carnivore', 'lion', or 'paleo'");
    }
    for (const key of ['diet_nuances', 'goals', 'bio', 'dismissed_milestones']) {
      expectString(p, key, 'profile');
    }
    if (p.theme_mode !== 'system' && p.theme_mode !== 'light' && p.theme_mode !== 'dark') {
      at('profile.theme_mode', "must be 'system', 'light', or 'dark'");
    }
    if (!isFlag(p.track_weight)) at('profile.track_weight', 'must be 0 or 1');
    if (p.starting_weight !== null && !isWeight(p.starting_weight)) {
      at('profile.starting_weight', 'must be null or a plausible weight in lbs');
    }
    const age = p.age;
    if (
      age !== null &&
      !(typeof age === 'number' && Number.isInteger(age) && age >= 0 && age <= 130)
    ) {
      at('profile.age', 'must be null or an integer 0-130');
    }
    if (p.sex !== '' && p.sex !== 'female' && p.sex !== 'male') {
      at('profile.sex', "must be '', 'female', or 'male'");
    }
    if (p.diet_start !== null && (typeof p.diet_start !== 'string' || !parseDietStart(p.diet_start))) {
      at('profile.diet_start', "must be null or 'YYYY-MM' / 'YYYY-MM-DD'");
    }
  }

  // -- lists ---------------------------------------------------------------
  // checkList validates structure + ids and returns the rows' ids so later
  // lists can check their references (medLogs -> medications, ...).
  const checkList = (
    key: string,
    checkRow: (row: Record<string, unknown>, path: string) => void,
  ): Set<number> => {
    const ids = new Set<number>();
    const rows = (value as Record<string, unknown>)[key];
    if (!Array.isArray(rows)) {
      at(key, 'must be an array');
      return ids;
    }
    rows.forEach((r, i) => {
      const path = `${key}[${i}]`;
      if (!isRecord(r)) {
        at(path, 'must be an object');
        return;
      }
      if (!isPositiveInt(r.id)) {
        at(`${path}.id`, 'must be a positive integer');
      } else {
        if (ids.has(r.id)) at(`${path}.id`, `duplicate id ${r.id}`);
        ids.add(r.id);
      }
      checkRow(r, path);
    });
    return ids;
  };

  const checkSchedulable = (row: Record<string, unknown>, path: string): void => {
    expectString(row, 'name', path);
    expectString(row, 'dosage', path);
    expectString(row, 'purpose', path);
    if (!isPositiveInt(row.times_per_day)) {
      at(`${path}.times_per_day`, 'must be a positive integer');
    }
    if (!isFlag(row.as_needed)) at(`${path}.as_needed`, 'must be 0 or 1');
  };
  checkList('allergies', (row, path) => expectString(row, 'name', path));
  checkList('conditions', (row, path) => expectString(row, 'name', path));
  const medicationIds = checkList('medications', checkSchedulable);
  const supplementIds = checkList('supplements', checkSchedulable);

  checkList('foodLogs', (row, path) => {
    expectString(row, 'name', path);
    expectString(row, 'meal_type', path);
    expectString(row, 'notes', path);
    expectTimestamp(row, 'logged_at', path);
  });
  checkList('medLogs', (row, path) => {
    const mid = row.medication_id;
    if (!isPositiveInt(mid)) {
      at(`${path}.medication_id`, 'must be a positive integer');
    } else if (!medicationIds.has(mid)) {
      at(`${path}.medication_id`, `no medication with id ${mid} in this backup`);
    }
    expectTimestamp(row, 'taken_at', path);
    expectQuantity(row, 'quantity', path);
  });
  checkList('symptomLogs', (row, path) => {
    expectString(row, 'name', path);
    expectString(row, 'notes', path);
    expectTimestamp(row, 'logged_at', path);
    const sev = row.severity;
    if (!(typeof sev === 'number' && Number.isInteger(sev) && sev >= 1 && sev <= 5)) {
      at(`${path}.severity`, 'must be an integer 1-5');
    }
  });
  checkList('supplementLogs', (row, path) => {
    expectString(row, 'name', path);
    expectString(row, 'notes', path);
    expectTimestamp(row, 'logged_at', path);
    expectQuantity(row, 'quantity', path);
    const sid = row.supplement_id;
    if (sid !== null) {
      if (!isPositiveInt(sid)) {
        at(`${path}.supplement_id`, 'must be null or a positive integer');
      } else if (!supplementIds.has(sid)) {
        at(`${path}.supplement_id`, `no supplement with id ${sid} in this backup`);
      }
    }
  });
  checkList('weightLogs', (row, path) => {
    if (!isWeight(row.weight)) at(`${path}.weight`, 'must be a plausible weight in lbs');
    expectTimestamp(row, 'logged_at', path);
  });

  return issues;
}

/**
 * Whether `value` is an importable KetoKind backup. Run BEFORE touching any
 * data: a wrong or tampered file must abort the import, never wipe the device.
 */
export function isDatabaseBackup(value: unknown): value is DatabaseBackup {
  return validateBackup(value).length === 0;
}

/** Coerce helpers so a slightly-off backup file can't write junk into the db. */
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const boolInt = (v: unknown): number => (v === 1 || v === true ? 1 : 0);

/**
 * Replace ALL on-device data with a validated backup. Runs in a transaction:
 * any failure rolls everything back instead of leaving a half-imported db.
 * The backup is validated first — an invalid file throws before anything is
 * deleted, so the existing data is never touched.
 */
export function importBackup(b: DatabaseBackup): void {
  const issues = validateBackup(b);
  if (issues.length > 0) {
    const [first] = issues;
    throw new Error(
      `Refusing to import invalid backup (${issues.length} problem${issues.length === 1 ? '' : 's'}): ${first.path} — ${first.message}`,
    );
  }
  database().withTransactionSync(() => {
    database().execSync(`
      DELETE FROM food_logs;
      DELETE FROM med_logs;
      DELETE FROM symptom_logs;
      DELETE FROM supplement_logs;
      DELETE FROM weight_logs;
      DELETE FROM allergies;
      DELETE FROM conditions;
      DELETE FROM medications;
      DELETE FROM supplements;
    `);

    const p = b.profile;
    const dietType: DietType =
      p.diet_type === 'keto' || p.diet_type === 'lion' || p.diet_type === 'paleo'
        ? p.diet_type
        : 'carnivore';
    const themeMode: ThemeMode =
      p.theme_mode === 'light' || p.theme_mode === 'dark' ? p.theme_mode : 'system';
    const sex = p.sex === 'female' || p.sex === 'male' ? p.sex : '';
    database().runSync(
      `INSERT OR REPLACE INTO profile
         (id, diet_type, diet_nuances, goals, theme_mode, track_weight, starting_weight,
          age, sex, bio, diet_start, dismissed_milestones)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dietType,
        str(p.diet_nuances),
        str(p.goals),
        themeMode,
        boolInt(p.track_weight),
        typeof p.starting_weight === 'number' && Number.isFinite(p.starting_weight) ? p.starting_weight : null,
        typeof p.age === 'number' && Number.isFinite(p.age) ? p.age : null,
        sex,
        str(p.bio),
        typeof p.diet_start === 'string' ? p.diet_start : null,
        str(p.dismissed_milestones),
      ],
    );

    for (const a of b.allergies) {
      database().runSync('INSERT INTO allergies (id, name) VALUES (?, ?)', [a.id, str(a.name)]);
    }
    for (const c of b.conditions) {
      database().runSync('INSERT INTO conditions (id, name) VALUES (?, ?)', [c.id, str(c.name)]);
    }
    for (const m of b.medications) {
      database().runSync(
        'INSERT INTO medications (id, name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?, ?)',
        [m.id, str(m.name), str(m.dosage), num(m.times_per_day, 1), str(m.purpose), boolInt(m.as_needed)],
      );
    }
    for (const s of b.supplements) {
      database().runSync(
        'INSERT INTO supplements (id, name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?, ?)',
        [s.id, str(s.name), str(s.dosage), num(s.times_per_day, 1), str(s.purpose), boolInt(s.as_needed)],
      );
    }
    for (const f of b.foodLogs) {
      database().runSync('INSERT INTO food_logs (id, name, meal_type, logged_at, notes) VALUES (?, ?, ?, ?, ?)', [
        f.id, str(f.name), str(f.meal_type, 'Meal'), str(f.logged_at), str(f.notes),
      ]);
    }
    for (const m of b.medLogs) {
      database().runSync('INSERT INTO med_logs (id, medication_id, taken_at, quantity) VALUES (?, ?, ?, ?)', [
        m.id, num(m.medication_id, 0), str(m.taken_at), num(m.quantity, 1),
      ]);
    }
    for (const s of b.symptomLogs) {
      database().runSync('INSERT INTO symptom_logs (id, name, severity, logged_at, notes) VALUES (?, ?, ?, ?, ?)', [
        s.id, str(s.name), num(s.severity, 3), str(s.logged_at), str(s.notes),
      ]);
    }
    for (const s of b.supplementLogs) {
      database().runSync(
        'INSERT INTO supplement_logs (id, name, supplement_id, logged_at, notes, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        [
          s.id,
          str(s.name),
          typeof s.supplement_id === 'number' && Number.isFinite(s.supplement_id) ? s.supplement_id : null,
          str(s.logged_at),
          str(s.notes),
          num(s.quantity, 1),
        ],
      );
    }
    for (const w of b.weightLogs) {
      database().runSync('INSERT INTO weight_logs (id, weight, logged_at) VALUES (?, ?, ?)', [
        w.id, num(w.weight, 0), str(w.logged_at),
      ]);
    }
    // Id counters continue after the highest restored id.
    database().execSync('DELETE FROM sqlite_sequence;');
  });
}
