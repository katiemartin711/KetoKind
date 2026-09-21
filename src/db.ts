// All SQLite access for the KetoKind app lives here.
// Uses expo-sqlite's synchronous API. Call initDb() once at startup.

import type * as SQLite from 'expo-sqlite';
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
import type { ThemeMode } from './theme';
import { parseDietStart } from './milestones';

/**
 * Minimal synchronous database surface this module needs. In production it is
 * implemented by expo-sqlite (see database() below); tests inject an
 * in-memory replacement via __setDbForTests().
 */
export interface DbHandle {
  getAllSync<T>(sql: string, params?: unknown[]): T[];
  getFirstSync<T>(sql: string, params?: unknown[]): T | null;
  runSync(sql: string, params?: unknown[]): void;
  execSync(sql: string): void;
  withTransactionSync(task: () => void): void;
}

let db: DbHandle | null = null;

/**
 * The live database handle, opened lazily on first use. Laziness — plus the
 * require() instead of a top-level import — keeps the native expo-sqlite
 * module out of Node test bundles: tests call __setDbForTests() before any
 * database access, so require('expo-sqlite') never runs there.
 */
function database(): DbHandle {
  if (!db) {
    const sqlite = require('expo-sqlite') as typeof SQLite;
    // expo-sqlite's parameter typings require `params`; at runtime the
    // argument is optional (existing call sites omit it), matching DbHandle.
    db = sqlite.openDatabaseSync('ketokind.db') as unknown as DbHandle;
  }
  return db;
}

/**
 * Test-only: swap the database handle (e.g. an in-memory SQLite when running
 * under Node). Production code never calls this.
 */
export function __setDbForTests(handle: DbHandle): void {
  db = handle;
}

/**
 * Schema version. Bump this and add an entry to MIGRATIONS whenever the
 * schema changes — initDb() applies every migration newer than the stored
 * PRAGMA user_version, in order.
 */
const SCHEMA_VERSION = 1;

/** version -> SQL statements to run when upgrading TO that version. */
const MIGRATIONS: Record<number, string[]> = {
  // 2: ['ALTER TABLE ... ADD COLUMN ...'],
};

/** ALTER TABLE ... ADD COLUMN, but only when the column isn't there yet. */
function addColumnIfMissing(table: string, column: string, definition: string): void {
  const cols = database().getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    database().execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Create tables on first launch and make sure the single profile row exists. */
export function initDb(): void {
  database().execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      diet_type TEXT NOT NULL DEFAULT 'carnivore',
      diet_nuances TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT '',
      theme_mode TEXT NOT NULL DEFAULT 'system',
      track_weight INTEGER NOT NULL DEFAULT 0,
      starting_weight REAL,
      age INTEGER,
      sex TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      diet_start TEXT,
      dismissed_milestones TEXT NOT NULL DEFAULT ''
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
      quantity INTEGER NOT NULL DEFAULT 1
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
  const existing = database().getFirstSync<{ id: number }>('SELECT id FROM profile WHERE id = 1');
  if (!existing) {
    database().runSync("INSERT INTO profile (id, diet_type, diet_nuances, goals) VALUES (1, 'carnivore', '', '')");
  }

  const stored = database().getFirstSync<{ v: number }>('PRAGMA user_version');
  const currentVersion = stored?.v ?? 0;
  if (currentVersion === 0) {
    // Databases created before versioning existed: bring every table up to the
    // v1 schema idempotently. Harmless on fresh installs (columns already there).
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
    const legacySuppLogs = database().getAllSync<{ id: number; name: string }>(
      'SELECT id, name FROM supplement_logs WHERE supplement_id IS NULL',
    );
    for (const row of legacySuppLogs) {
      const match = database().getFirstSync<{ id: number }>(
        'SELECT id FROM supplements WHERE lower(trim(name)) = lower(trim(?))',
        [row.name],
      );
      if (match) {
        database().runSync('UPDATE supplement_logs SET supplement_id = ? WHERE id = ?', [match.id, row.id]);
      }
    }
  }
  // Apply any newer migrations in order, then stamp the version.
  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    for (const stmt of MIGRATIONS[v] ?? []) {
      database().execSync(stmt);
    }
  }
  database().execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
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
  const row = database().getFirstSync<Profile>('SELECT * FROM profile WHERE id = 1');
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
  database().runSync(
    'UPDATE profile SET diet_type = ?, diet_nuances = ?, goals = ?, age = ?, sex = ?, bio = ?, diet_start = ? WHERE id = 1',
    [dietType, nuances.trim(), goals.trim(), age, sex, bio, dietStart],
  );
}

/** Milestone keys (e.g. 'd30', 'y1') the user already dismissed. */
export function getDismissedMilestones(): string[] {
  const row = database().getFirstSync<{ dismissed_milestones: string }>(
    'SELECT dismissed_milestones FROM profile WHERE id = 1',
  );
  const raw = row?.dismissed_milestones ?? '';
  return raw ? raw.split(',').filter(Boolean) : [];
}

/** Wipe everything on device: all logs, lists, and profile fields back to
 *  defaults. Appearance/theme is left alone — it's a preference, not data. */
export function deleteAllData(): void {
  database().execSync(`
    DELETE FROM allergies;
    DELETE FROM conditions;
    DELETE FROM medications;
    DELETE FROM supplements;
    DELETE FROM food_logs;
    DELETE FROM med_logs;
    DELETE FROM symptom_logs;
    DELETE FROM supplement_logs;
    DELETE FROM weight_logs;
    UPDATE profile SET
      diet_type = 'carnivore',
      diet_nuances = '',
      goals = '',
      track_weight = 0,
      starting_weight = NULL,
      age = NULL,
      sex = '',
      bio = '',
      diet_start = NULL,
      dismissed_milestones = ''
    WHERE id = 1;
  `);
  // Actually purge the deleted rows from the file (DELETE alone leaves them
  // in free pages) and reset id counters.
  database().execSync('DELETE FROM sqlite_sequence;');
  database().execSync('VACUUM;');
}

// ---------------------------------------------------------------------------
// Full backup / restore (device switching)
// ---------------------------------------------------------------------------

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
    if (p.diet_type !== 'keto' && p.diet_type !== 'carnivore' && p.diet_type !== 'lion') {
      at('profile.diet_type', "must be 'keto', 'carnivore', or 'lion'");
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
      p.diet_type === 'keto' || p.diet_type === 'lion' ? p.diet_type : 'carnivore';
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
  database().runSync('UPDATE profile SET dismissed_milestones = ? WHERE id = 1', [merged.join(',')]);
}

/** Persist just the diet type — auto-saved the moment the user taps an option. */
export function persistDietType(dietType: DietType): void {
  database().runSync('UPDATE profile SET diet_type = ? WHERE id = 1', [dietType]);
}

/** Weight-tracking preference + starting weight (lbs, null when unset). */
export function setWeightTracking(trackWeight: boolean, startingWeight: number | null): void {
  database().runSync('UPDATE profile SET track_weight = ?, starting_weight = ? WHERE id = 1', [
    trackWeight ? 1 : 0,
    startingWeight,
  ]);
}

/** 'system' (default) follows the phone's light/dark setting. */
export function getThemeMode(): ThemeMode {
  const row = database().getFirstSync<{ theme_mode: string }>('SELECT theme_mode FROM profile WHERE id = 1');
  const m = row?.theme_mode;
  return m === 'light' || m === 'dark' ? m : 'system';
}

export function setThemeMode(mode: ThemeMode): void {
  database().runSync('UPDATE profile SET theme_mode = ? WHERE id = 1', [mode]);
}

// ---------------------------------------------------------------------------
// Allergies / conditions / medications / supplements (profile lists)
// ---------------------------------------------------------------------------

export function listAllergies(): Allergy[] {
  return database().getAllSync<Allergy>('SELECT * FROM allergies ORDER BY name');
}

export function addAllergy(name: string): void {
  database().runSync('INSERT INTO allergies (name) VALUES (?)', [name.trim()]);
}

export function deleteAllergy(id: number): void {
  database().runSync('DELETE FROM allergies WHERE id = ?', [id]);
}

export function listConditions(): Condition[] {
  return database().getAllSync<Condition>('SELECT * FROM conditions ORDER BY name');
}

export function addCondition(name: string): void {
  database().runSync('INSERT INTO conditions (name) VALUES (?)', [name.trim()]);
}

export function deleteCondition(id: number): void {
  database().runSync('DELETE FROM conditions WHERE id = ?', [id]);
}

export function listMedications(): Medication[] {
  return database().getAllSync<Medication>('SELECT * FROM medications ORDER BY name');
}

export function addMedication(
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'INSERT INTO medications (name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0],
  );
}

export function deleteMedication(id: number): void {
  database().runSync('DELETE FROM medications WHERE id = ?', [id]);
}

export function updateMedication(
  id: number,
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'UPDATE medications SET name = ?, dosage = ?, times_per_day = ?, purpose = ?, as_needed = ? WHERE id = ?',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0, id],
  );
}

export function listSupplements(): Supplement[] {
  return database().getAllSync<Supplement>('SELECT * FROM supplements ORDER BY name');
}

export function addSupplement(
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'INSERT INTO supplements (name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0],
  );
}

export function deleteSupplement(id: number): void {
  database().runSync('DELETE FROM supplements WHERE id = ?', [id]);
}

export function updateSupplement(
  id: number,
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'UPDATE supplements SET name = ?, dosage = ?, times_per_day = ?, purpose = ?, as_needed = ? WHERE id = ?',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0, id],
  );
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function addFoodLog(name: string, mealType: string, notes: string, loggedAt: string): void {
  database().runSync('INSERT INTO food_logs (name, meal_type, logged_at, notes) VALUES (?, ?, ?, ?)', [
    name.trim(),
    mealType,
    loggedAt,
    notes.trim(),
  ]);
}

export function addMedLog(medicationId: number, takenAt: string, quantity: number = 1): void {
  database().runSync('INSERT INTO med_logs (medication_id, taken_at, quantity) VALUES (?, ?, ?)', [
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
  database().runSync('UPDATE med_logs SET medication_id = ?, taken_at = ?, quantity = ? WHERE id = ?', [
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

export function getMedLog(id: number): Pick<MedLog, 'id' | 'medication_id' | 'taken_at' | 'quantity'> | null {
  return database().getFirstSync<Pick<MedLog, 'id' | 'medication_id' | 'taken_at' | 'quantity'>>(
    'SELECT id, medication_id, taken_at, quantity FROM med_logs WHERE id = ?',
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
  const meds = database().getAllSync<Omit<MedLog, 'medication_name'> & { medication_name: string | null }>(
    `SELECT med_logs.id, med_logs.medication_id, medications.name AS medication_name, med_logs.taken_at, med_logs.quantity
     FROM med_logs LEFT JOIN medications ON medications.id = med_logs.medication_id
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
      // The medication may have been deleted from the profile since — the
      // dose history is still real, so keep showing it.
      title: m.medication_name ?? 'Deleted medication',
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
    recentMeds: database().getAllSync<MedLog & { medication_name: string | null }>(
      `SELECT med_logs.id, med_logs.medication_id, medications.name AS medication_name, med_logs.taken_at, med_logs.quantity
       FROM med_logs LEFT JOIN medications ON medications.id = med_logs.medication_id
       WHERE taken_at BETWEEN ? AND ? ORDER BY taken_at DESC LIMIT 60`,
      [startIso, endIso],
    ),
    rangeLabel,
  };
}
