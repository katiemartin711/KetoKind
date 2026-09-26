// Backup/restore tests for src/db.ts — round-trip, rejection, and rollback.
// Runs the REAL db.ts code against an in-memory SQLite (node:sqlite) via the
// injectable DbHandle, so export/import/deleteAllData are genuinely exercised.
// Run with: npm test
// (tsc compiles src/ to dist-test/, node runs dist-test/backup.test.js.)

import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { exportBackup, importBackup, isDatabaseBackup, validateBackup } from './db/backup';
import type { DatabaseBackup } from './db/backup';
import { addAllergy, addCondition, addMedication, addSupplement, deleteMedication, listMedications, listSupplements, updateMedication } from './db/catalog';
import { __setDbForTests } from './db/client';
import { addFoodLog, addMedLog, addSupplementLog, addSymptomLog, addWeightLog, getFoodLog, getLogsForDay, setFoodMacros, updateMedLog } from './db/logs';
import { deleteAllData, dismissMilestones, getLlmOffer, getProStatus, getTrackCalories, saveProfile, setLlmOffer, setProStatus, setThemeMode, setTrackCalories, setWeightTracking } from './db/profile';
import { initDb } from './db/schema';
import { database } from './db/client';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`);
  }
}

function eq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`expected truthy: ${label}`);
}

function throws(fn: () => void, label: string): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(`expected throw: ${label}`);
}

function mustFind<T>(arr: T[], pred: (t: T) => boolean, label: string): T {
  const found = arr.find(pred);
  if (!found) throw new Error(`setup: ${label} not found`);
  return found;
}

/** Fresh in-memory database with the real schema, installed as db.ts's handle. */
function setup(): NodeSqliteHandle {
  const handle = new NodeSqliteHandle();
  __setDbForTests(handle);
  initDb();
  return handle;
}

/** Representative data across every table the backup covers. */
function populateDb(): void {
  saveProfile('keto', 'No dairy', 'Lose 20 lbs', 32, 'female', 'Test bio', '2024-03-14', 'Katie');
  setWeightTracking(true, 180);
  setThemeMode('dark');
  dismissMilestones(['d7']);
  addAllergy('Peanuts');
  addAllergy('Dairy');
  addCondition('Type 2 diabetes');
  addMedication('Metformin', '500mg', 2, 'blood sugar', false);
  addMedication('Melatonin', '3mg', 1, 'sleep', true);
  addSupplement('Magnesium', '400mg', 1, 'sleep', false);
  const medId = mustFind(listMedications(), (m) => m.name === 'Metformin', 'Metformin').id;
  const suppId = mustFind(listSupplements(), (s) => s.name === 'Magnesium', 'Magnesium').id;
  const t1 = '2026-09-15T12:00:00.000Z';
  const t2 = '2026-09-16T08:30:00.000Z';
  addFoodLog('Ribeye steak', 'Dinner', 'grass-fed', t1);
  addFoodLog('Eggs', 'Breakfast', '', t2);
  addMedLog(medId, t1, 2);
  addSymptomLog('Headache', 4, 'afternoon slump', t1);
  addSupplementLog(suppId, t2, 1);
  addWeightLog(182.5, t2);
}

/** exportBackup() as a comparable string (exportedAt is always fresh). */
function snapshot(): string {
  const b = exportBackup();
  return JSON.stringify({ ...b, exportedAt: '<stripped>' });
}

/** A valid backup, parsed from JSON exactly like the import flow does. */
function validBackup(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(exportBackup())) as Record<string, unknown>;
}

function rowsOf(b: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const rows = b[key];
  if (!Array.isArray(rows)) throw new Error(`setup: ${key} is not an array`);
  return rows as Record<string, unknown>[];
}

/**
 * Populate, snapshot, attempt to import a mutated (invalid) backup, and assert:
 * validation reports issues, the guard rejects, importBackup throws, and the
 * database is byte-identical to before.
 */
function expectRejected(name: string, mutate: (b: Record<string, unknown>) => void): void {
  check(name, () => {
    const handle = setup();
    try {
      populateDb();
      const before = snapshot();
      const bad = validBackup();
      mutate(bad);
      const issues = validateBackup(bad);
      ok(issues.length > 0, 'validateBackup reports at least one issue');
      eq(isDatabaseBackup(bad), false, 'isDatabaseBackup rejects');
      throws(() => importBackup(bad as unknown as DatabaseBackup), 'importBackup throws');
      eq(snapshot(), before, 'database unchanged after rejected import');
    } finally {
      handle.close();
    }
  });
}

// --- round-trip -------------------------------------------------------------
check('round-trip: export -> wipe -> import restores identical data', () => {
  const handle = setup();
  try {
    populateDb();
    const before = snapshot();
    // Through real JSON, like a file on disk.
    const fileContents = JSON.stringify(exportBackup());
    deleteAllData();
    eq(exportBackup().foodLogs.length, 0, 'wipe empties food logs');
    eq(exportBackup().medications.length, 0, 'wipe empties medications');
    const parsed: unknown = JSON.parse(fileContents);
    ok(isDatabaseBackup(parsed), 'exported backup validates');
    if (isDatabaseBackup(parsed)) {
      importBackup(parsed);
    }
    eq(snapshot(), before, 'restored data identical to original');
  } finally {
    handle.close();
  }
});

// --- malformed backups ------------------------------------------------------
check('rejects invalid JSON', () => {
  const handle = setup();
  try {
    populateDb();
    const before = snapshot();
    let parsed: unknown;
    try {
      parsed = JSON.parse('{"version": 1, broken');
    } catch {
      parsed = null; // same fallback the import screen uses
    }
    eq(isDatabaseBackup(parsed), false, 'isDatabaseBackup rejects');
    eq(validateBackup(parsed).length > 0, true, 'validateBackup reports issues');
    eq(snapshot(), before, 'database unchanged');
  } finally {
    handle.close();
  }
});

expectRejected('rejects wrong version', (b) => {
  b.version = 2;
});
expectRejected('rejects missing list', (b) => {
  delete b.foodLogs;
});
expectRejected('rejects non-array list', (b) => {
  b.foodLogs = {};
});
expectRejected('rejects row with non-numeric id', (b) => {
  rowsOf(b, 'foodLogs')[0].id = 'x';
});
expectRejected('rejects row with fractional id', (b) => {
  rowsOf(b, 'foodLogs')[0].id = 1.5;
});
expectRejected('rejects row with zero id', (b) => {
  rowsOf(b, 'foodLogs')[0].id = 0;
});
expectRejected('rejects non-object row', (b) => {
  (b.foodLogs as unknown[])[0] = 42;
});
expectRejected('rejects null profile', (b) => {
  b.profile = null;
});
expectRejected('rejects unknown diet_type', (b) => {
  (b.profile as Record<string, unknown>).diet_type = 'vegan';
});

// --- strengthened validation ------------------------------------------------
expectRejected('rejects duplicate ids within a list', (b) => {
  const allergies = rowsOf(b, 'allergies');
  allergies.push({ ...allergies[0] });
});
expectRejected('rejects duplicate ids in medications', (b) => {
  const meds = rowsOf(b, 'medications');
  meds.push({ ...meds[0] });
});
expectRejected('rejects impossible date (Feb 30)', (b) => {
  rowsOf(b, 'foodLogs')[0].logged_at = '2024-02-30T12:00:00.000Z';
});
expectRejected('rejects non-ISO timestamp', (b) => {
  rowsOf(b, 'foodLogs')[0].logged_at = 'September 15th, 2026';
});
expectRejected('rejects non-string timestamp', (b) => {
  rowsOf(b, 'weightLogs')[0].logged_at = 1726400000000;
});
expectRejected('rejects dangling medication reference', (b) => {
  rowsOf(b, 'medLogs')[0].medication_id = 9999;
});
expectRejected('rejects dangling supplement reference', (b) => {
  rowsOf(b, 'supplementLogs')[0].supplement_id = 9999;
});
expectRejected('rejects negative quantity', (b) => {
  rowsOf(b, 'medLogs')[0].quantity = -1;
});
expectRejected('rejects zero quantity', (b) => {
  rowsOf(b, 'supplementLogs')[0].quantity = 0;
});
expectRejected('rejects out-of-range severity', (b) => {
  rowsOf(b, 'symptomLogs')[0].severity = 6;
});
expectRejected('rejects zero severity', (b) => {
  rowsOf(b, 'symptomLogs')[0].severity = 0;
});
expectRejected('rejects negative weight', (b) => {
  rowsOf(b, 'weightLogs')[0].weight = -5;
});
expectRejected('rejects implausible age', (b) => {
  (b.profile as Record<string, unknown>).age = 200;
});
expectRejected('rejects zero times_per_day', (b) => {
  rowsOf(b, 'medications')[0].times_per_day = 0;
});
expectRejected('rejects bad diet_start', (b) => {
  (b.profile as Record<string, unknown>).diet_start = '2024-13-45';
});

check('null supplement_id (legacy log) is valid', () => {
  const handle = setup();
  try {
    populateDb();
    const b = validBackup();
    rowsOf(b, 'supplementLogs')[0].supplement_id = null;
    eq(validateBackup(b), [], 'no issues');
    ok(isDatabaseBackup(b), 'guard accepts');
  } finally {
    handle.close();
  }
});

check('valid backup validates clean', () => {
  const handle = setup();
  try {
    populateDb();
    eq(validateBackup(exportBackup()), [], 'no issues on real export');
    ok(isDatabaseBackup(JSON.parse(JSON.stringify(exportBackup()))), 'guard accepts');
  } finally {
    handle.close();
  }
});

check('accepts paleo diet_type and preserves it through import', () => {
  const handle = setup();
  try {
    populateDb();
    const b = validBackup();
    (b.profile as Record<string, unknown>).diet_type = 'paleo';
    eq(validateBackup(b), [], 'no issues');
    ok(isDatabaseBackup(b), 'guard accepts');
    importBackup(b as unknown as DatabaseBackup);
    eq(exportBackup().profile.diet_type, 'paleo', 'paleo survives round-trip');
  } finally {
    handle.close();
  }
});

// --- rollback ----------------------------------------------------------------
check('importBackup validates before deleting: original data survives', () => {
  const handle = setup();
  try {
    populateDb();
    const before = snapshot();
    const bad = validBackup();
    rowsOf(bad, 'allergies').push({ ...rowsOf(bad, 'allergies')[0] });
    throws(() => importBackup(bad as unknown as DatabaseBackup), 'importBackup throws');
    eq(snapshot(), before, 'original data fully intact');
  } finally {
    handle.close();
  }
});

check('mid-transaction failure rolls back the whole import', () => {
  const handle = setup();
  try {
    populateDb();
    const before = snapshot();
    const good = validBackup();
    ok(isDatabaseBackup(good), 'backup is valid');
    // Fail on the 3rd write inside the import: profile + first allergy are
    // already written and the DELETEs are done — a genuine mid-import crash.
    handle.armWriteFailure(3);
    throws(
      () => importBackup(good as unknown as DatabaseBackup),
      'importBackup throws on I/O failure',
    );
    eq(snapshot(), before, 'database rolled back to original data');
  } finally {
    handle.close();
  }
});

check('withTransactionSync commits on success, rolls back on throw', () => {
  const handle = setup();
  try {
    handle.execSync('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    handle.withTransactionSync(() => {
      handle.runSync("INSERT INTO t (v) VALUES ('a')");
    });
    eq(handle.getAllSync<{ v: string }>('SELECT v FROM t'), [{ v: 'a' }], 'commit persists');
    throws(() => {
      handle.withTransactionSync(() => {
        handle.runSync("INSERT INTO t (v) VALUES ('b')");
        throw new Error('boom');
      });
    }, 'task throw propagates');
    eq(
      handle.getAllSync<{ v: string }>('SELECT v FROM t'),
      [{ v: 'a' }],
      'thrown row rolled back',
    );
  } finally {
    handle.close();
  }
});

// --- v2 migration & data integrity -------------------------------------------
/**
 * A database in the exact v1 shape (no name columns), as if created by the
 * app before the v2 migration existed. initDb() must migrate it for real.
 */
function setupV1(): NodeSqliteHandle {
  const handle = new NodeSqliteHandle();
  __setDbForTests(handle);
  handle.execSync(`
    CREATE TABLE profile (
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
    CREATE TABLE medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      times_per_day INTEGER NOT NULL DEFAULT 1,
      purpose TEXT NOT NULL DEFAULT '',
      as_needed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE med_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      taken_at TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
  `);
  handle.runSync('INSERT INTO profile (id) VALUES (1)');
  handle.execSync('PRAGMA user_version = 1;');
  return handle;
}

check('v2 migration adds name columns and backfills med-log names', () => {
  const handle = setupV1();
  try {
    handle.runSync(
      "INSERT INTO medications (name, dosage, times_per_day, purpose, as_needed) VALUES ('Metformin', '500mg', 2, 'blood sugar', 0)",
    );
    handle.runSync(
      "INSERT INTO med_logs (medication_id, taken_at, quantity) VALUES (1, '2026-09-10T08:00:00.000Z', 2)",
    );
    // A dose whose medication was deleted before v2 — nothing to backfill from.
    handle.runSync(
      "INSERT INTO med_logs (medication_id, taken_at, quantity) VALUES (999, '2026-09-11T08:00:00.000Z', 1)",
    );
    initDb(); // runs the real v2 migration
    const rows = handle.getAllSync<{ id: number; name: string }>(
      'SELECT id, name FROM med_logs ORDER BY id',
    );
    eq(
      rows,
      [
        { id: 1, name: 'Metformin' },
        { id: 2, name: '' },
      ],
      'names backfilled from medications; orphan stays empty',
    );
    eq(
      handle.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version,
      8,
      'version stamped at 8',
    );
    const profileCols = handle.getAllSync<{ name: string }>('PRAGMA table_info(profile)');
    ok(
      profileCols.some((c) => c.name === 'name'),
      'profile.name column exists after migration',
    );
  } finally {
    handle.close();
  }
});

check('med-log name snapshot survives medication rename and delete', () => {
  const handle = setup();
  try {
    addMedication('Metformin', '500mg', 2, 'blood sugar', false);
    const medId = mustFind(listMedications(), (m) => m.name === 'Metformin', 'Metformin').id;
    addMedLog(medId, '2026-09-15T08:00:00.000Z', 1);
    const day = new Date('2026-09-15T12:00:00');
    updateMedication(medId, 'Metformin ER', '500mg', 2, 'blood sugar', false);
    eq(getLogsForDay(day)[0].title, 'Metformin', 'history keeps the name from log time');
    deleteMedication(medId);
    eq(getLogsForDay(day)[0].title, 'Metformin', 'history keeps the name after delete');
  } finally {
    handle.close();
  }
});

check('updateMedLog re-snapshots the medication name', () => {
  const handle = setup();
  try {
    addMedication('Metformin', '500mg', 2, 'blood sugar', false);
    addMedication('Melatonin', '3mg', 1, 'sleep', true);
    const metId = mustFind(listMedications(), (m) => m.name === 'Metformin', 'm1').id;
    const melId = mustFind(listMedications(), (m) => m.name === 'Melatonin', 'm2').id;
    addMedLog(metId, '2026-09-15T08:00:00.000Z', 1);
    const day = new Date('2026-09-15T12:00:00');
    const logId = getLogsForDay(day)[0].id;
    updateMedication(metId, 'Metformin ER', '500mg', 2, 'blood sugar', false);
    updateMedLog(logId, melId, '2026-09-15T09:00:00.000Z', 1);
    eq(getLogsForDay(day)[0].title, 'Melatonin', 'edit points the dose at the new medication');
  } finally {
    handle.close();
  }
});

check('legacy (pre-v2) backup without med names imports and backfills', () => {
  const handle = setup();
  try {
    populateDb();
    const b = validBackup();
    // Strip the v2 fields, exactly like a backup exported by the old app.
    delete (b.profile as Record<string, unknown>).name;
    for (const r of rowsOf(b, 'medLogs')) delete r.name;
    eq(validateBackup(b), [], 'legacy backup still validates');
    ok(isDatabaseBackup(b), 'guard accepts legacy backup');
    importBackup(b as unknown as DatabaseBackup);
    ok(
      exportBackup().medLogs.every((m) => m.name !== ''),
      'med names backfilled from restored medications',
    );
    eq(exportBackup().profile.name, '', 'missing profile name defaults to empty');
  } finally {
    handle.close();
  }
});

check('deleteAllData resets theme_mode and name', () => {
  const handle = setup();
  try {
    populateDb(); // sets theme dark and name Katie
    deleteAllData();
    const p = exportBackup().profile;
    eq(p.theme_mode, 'system', 'theme reset to system');
    eq(p.name, '', 'name cleared');
    eq(p.diet_type, 'carnivore', 'other fields still reset');
  } finally {
    handle.close();
  }
});

check('profile name survives backup round-trip', () => {
  const handle = setup();
  try {
    populateDb();
    const before = snapshot();
    const parsed: unknown = JSON.parse(JSON.stringify(exportBackup()));
    ok(isDatabaseBackup(parsed), 'validates');
    if (isDatabaseBackup(parsed)) importBackup(parsed);
    eq(snapshot(), before, 'restored data identical, name included');
  } finally {
    handle.close();
  }
});

check('export omits is_pro — Pro is restored via the store, not backups', () => {
  const handle = setup();
  try {
    populateDb();
    setProStatus(true);
    const raw = JSON.parse(JSON.stringify(exportBackup())) as Record<string, unknown>;
    const profile = raw.profile as Record<string, unknown>;
    eq('is_pro' in profile, false, 'is_pro not in exported profile');
    ok(isDatabaseBackup(raw), 'backup without is_pro still validates');
  } finally {
    handle.close();
  }
});

check('import preserves this device is_pro and ignores a stale backup flag', () => {
  const handle = setup();
  try {
    populateDb();
    setProStatus(true);
    const file = JSON.parse(JSON.stringify(exportBackup())) as Record<string, unknown>;
    // Older backups may still carry is_pro — treat it as noise.
    (file.profile as Record<string, unknown>).is_pro = 0;
    ok(isDatabaseBackup(file), 'legacy is_pro field does not invalidate');
    // Wipe resets Pro; import must keep the wiped device's flag (0), not
    // invent entitlement from the file.
    deleteAllData();
    eq(getProStatus(), false, 'wipe cleared Pro');
    if (isDatabaseBackup(file)) importBackup(file);
    eq(getProStatus(), false, 'import did not grant Pro from file');
    // Grant on-device, re-import: flag must survive.
    setProStatus(true);
    if (isDatabaseBackup(file)) importBackup(file);
    eq(getProStatus(), true, 'import kept device Pro status');
  } finally {
    handle.close();
  }
});

check('meal macros round-trip and llm_offer stays on this device', () => {
  const handle = setup();
  try {
    populateDb();
    const id = addFoodLog('Eggs and steak', 'Breakfast', '', '2026-09-17T08:00:00.000Z');
    setFoodMacros(id, { proteinG: 40, fatG: 30, carbsG: 2, fiberG: 0, netCarbsG: 2, calories: 450 }, 'estimated');
    setTrackCalories(true);
    setLlmOffer('declined');
    const file = JSON.parse(JSON.stringify(exportBackup())) as Record<string, unknown>;
    const profile = file.profile as Record<string, unknown>;
    eq(profile.track_calories, 1, 'calorie toggle is in the backup');
    eq('llm_offer' in profile, false, 'download choice is not in the backup');
    ok(isDatabaseBackup(file), 'macros backup validates');
    setLlmOffer('');
    setTrackCalories(false);
    if (isDatabaseBackup(file)) importBackup(file);
    const row = getFoodLog(id);
    eq(row?.protein_g, 40, 'protein restored');
    eq(row?.net_carbs_g, 2, 'net carbs restored');
    eq(row?.macro_source, 'estimated', 'source restored');
    eq(getTrackCalories(), true, 'calorie toggle restored');
    eq(getLlmOffer(), '', 'declined choice on the device was cleared before import and not revived');
    setLlmOffer('declined');
    if (isDatabaseBackup(file)) importBackup(file);
    eq(getLlmOffer(), 'declined', 'import keeps this device download choice');
  } finally {
    handle.close();
  }
});

check('schema v5 creates log timestamp indexes', () => {
  const handle = setup();
  try {
    const indexes = database().getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%_logs_%'`,
    );
    const names = indexes.map((r) => r.name).sort();
    ok(names.includes('idx_food_logs_logged_at'), 'food index');
    ok(names.includes('idx_med_logs_taken_at'), 'med index');
    ok(names.includes('idx_symptom_logs_logged_at'), 'symptom index');
    ok(names.includes('idx_supplement_logs_logged_at'), 'supplement index');
    ok(names.includes('idx_weight_logs_logged_at'), 'weight index');
  } finally {
    handle.close();
  }
});

console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
