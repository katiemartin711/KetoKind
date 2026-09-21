// getLogsOfKind tests: the all-logs query behind the Dashboard drill-down
// screens. Runs against in-memory SQLite via the injectable DbHandle.

import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { addMedication, addSupplement } from './db/catalog';
import { __setDbForTests } from './db/client';
import { addFoodLog, addMedLog, addSupplementLog, addSymptomLog, addWeightLog, deleteLog, getLogsOfKind } from './db/logs';
import { initDb } from './db/schema';

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
  if (!cond) throw new Error(`expected true: ${label}`);
}

function iso(y: number, m: number, d: number, h: number = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

function setup(): void {
  __setDbForTests(new NodeSqliteHandle());
  initDb();
}

function seed(): void {
  setup();
  addFoodLog('Steak', 'Dinner', 'ribeye', iso(2026, 3, 1, 19));
  addFoodLog('Eggs', 'Breakfast', '', iso(2026, 3, 2, 8));
  addMedication('Cetirizine', '10mg', 1, 'allergies', false);
  addMedLog(1, iso(2026, 3, 1, 8));
  addMedLog(1, iso(2026, 3, 2, 8), 2);
  addSupplement('Magnesium', '400mg', 1, 'sleep', false);
  addSupplementLog(1, iso(2026, 3, 2, 21));
  addSymptomLog('Headache', 4, 'afternoon', iso(2026, 3, 1, 15));
  addSymptomLog('Headache', 2, '', iso(2026, 3, 2, 15));
  addWeightLog(150.5, iso(2026, 3, 1, 7));
  addWeightLog(149.8, iso(2026, 3, 2, 7));
}

check('getLogsOfKind returns each kind newest-first', () => {
  seed();
  const meals = getLogsOfKind('meal');
  eq(meals.map((l) => l.title), ['Eggs', 'Steak'], 'meal order');
  ok(meals.every((l) => l.kind === 'meal'), 'meal kinds');

  const meds = getLogsOfKind('medication');
  eq(meds.map((l) => l.detail), ['Took 2', 'Taken'], 'med order + qty detail');

  const symptoms = getLogsOfKind('symptom');
  eq(symptoms.map((l) => l.detail), ['Severity 2/5', 'Severity 4/5 — afternoon'], 'symptom detail');

  const supps = getLogsOfKind('supplement');
  eq(supps.length, 1, 'one supplement log');
  eq(supps[0].title, 'Magnesium', 'supplement snapshot name');

  const weights = getLogsOfKind('weight');
  eq(weights.map((l) => l.title), ['149.8 lbs', '150.5 lbs'], 'weight order');
});

check('getLogsOfKind normalizes the same way as the day list', () => {
  seed();
  const med = getLogsOfKind('medication')[0];
  eq(med.title, 'Cetirizine', 'med name snapshot kept');
  const meal = getLogsOfKind('meal')[0];
  eq(meal.detail, 'Breakfast', 'meal detail without notes');
});

check('getLogsOfKind returns [] for an empty kind', () => {
  setup();
  eq(getLogsOfKind('symptom'), [], 'no symptoms -> empty');
});

check('deleteLog removes the entry from getLogsOfKind', () => {
  seed();
  const before = getLogsOfKind('weight');
  deleteLog('weight', before[0].id);
  const after = getLogsOfKind('weight');
  eq(after.map((l) => l.title), ['150.5 lbs'], 'newest weigh-in deleted');
});

console.log(`logs.test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
