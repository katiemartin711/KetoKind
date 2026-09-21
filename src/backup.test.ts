// Backup/restore tests for src/db.ts — round-trip, rejection, and rollback.
// Runs the REAL db.ts code against an in-memory SQLite (node:sqlite) via the
// injectable DbHandle, so export/import/deleteAllData are genuinely exercised.
// Run with: npm test
// (tsc compiles src/ to dist-test/, node runs dist-test/backup.test.js.)

import { NodeSqliteHandle } from './nodeSqliteAdapter';
import {
  __setDbForTests,
  addAllergy,
  addCondition,
  addFoodLog,
  addMedication,
  addMedLog,
  addSupplement,
  addSupplementLog,
  addSymptomLog,
  addWeightLog,
  deleteAllData,
  dismissMilestones,
  exportBackup,
  importBackup,
  initDb,
  isDatabaseBackup,
  listMedications,
  listSupplements,
  saveProfile,
  setThemeMode,
  setWeightTracking,
  validateBackup,
  type DatabaseBackup,
} from './db';

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
  saveProfile('keto', 'No dairy', 'Lose 20 lbs', 32, 'female', 'Test bio', '2024-03-14');
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
  (b.profile as Record<string, unknown>).diet_type = 'paleo';
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
