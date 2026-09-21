// Trends stats tests: the pure math in src/trendsStats.ts plus the db
// query helpers in src/db/trends.ts (run against in-memory SQLite via the
// injectable DbHandle, like pro.test.ts). Run with: npm test

import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { addMedication, addSupplement } from './db/catalog';
import { __setDbForTests, database } from './db/client';
import { addMedLog, addSupplementLog, addSymptomLog, addWeightLog } from './db/logs';
import { initDb } from './db/schema';
import { getItemDayList, getSymptomDayMap, getWeightSeries } from './db/trends';
import {
  MIN_BASELINE_DAYS,
  MIN_COMPARISON_DAYS,
  MIN_PATTERN_DAYS,
  average,
  bucketDays,
  comparePattern,
  filterSymptomRange,
  filterWeightRange,
  localDayKey,
  rankPatterns,
  round1,
  shortDayLabel,
  summarizeWeights,
} from './trendsStats';
import type { SymptomDay } from './trendsStats';

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

/** ISO string for a local date/time — TZ-independent day bucketing. */
function iso(y: number, m: number, d: number, h: number = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

/** Fresh in-memory database with the real schema, installed as db's handle. */
function setup(): void {
  const handle = new NodeSqliteHandle();
  __setDbForTests(handle);
  initDb();
}

// --- pure stats ---

check('localDayKey buckets an ISO timestamp by local date', () => {
  eq(localDayKey(iso(2026, 3, 4, 23)), '2026-03-04', 'late evening stays on the 4th');
  eq(localDayKey(iso(2026, 3, 5, 1)), '2026-03-05', 'early morning lands on the 5th');
  eq(localDayKey(iso(2026, 12, 31, 12)), '2026-12-31', 'year end');
});

check('shortDayLabel formats M/D', () => {
  eq(shortDayLabel('2026-03-04'), '3/4', 'march 4');
});

check('average and round1', () => {
  eq(average([1, 2, 3, 4]), 2.5, 'mean');
  eq(average([]), null, 'empty -> null');
  eq(round1(2.34), 2.3, 'rounds down');
  eq(round1(2.35), 2.4, 'rounds up');
});

check('bucketDays splits severities by item-day membership', () => {
  const days: SymptomDay[] = [
    { day: '2026-01-01', severity: 4 },
    { day: '2026-01-02', severity: 2 },
    { day: '2026-01-03', severity: 5 },
  ];
  const b = bucketDays(days, new Set(['2026-01-01', '2026-01-03']));
  eq(b.taken, [4, 5], 'taken severities');
  eq(b.notTaken, [2], 'not-taken severities');
});

/** 14 symptom days: first 7 with the item taken, last 7 without. */
function twoSidedSymptomDays(takenSev: number, notTakenSev: number): SymptomDay[] {
  const days: SymptomDay[] = [];
  for (let d = 1; d <= 14; d++) {
    days.push({
      day: `2026-01-${String(d).padStart(2, '0')}`,
      severity: d <= 7 ? takenSev : notTakenSev,
    });
  }
  return days;
}

function itemDaysFor(first7: boolean): Set<string> {
  const s = new Set<string>();
  for (let d = 1; d <= 14; d++) {
    if (first7 ? d <= 7 : d > 7) s.add(`2026-01-${String(d).padStart(2, '0')}`);
  }
  return s;
}

check('comparePattern computes avgs, diff, and day counts at threshold', () => {
  const c = comparePattern('Headache', twoSidedSymptomDays(2, 4), 'Magnesium', 'supplement', itemDaysFor(true));
  if (!c) throw new Error('expected a comparison at 7/7 days');
  eq(c.avgTaken, 2, 'avg taken');
  eq(c.avgNotTaken, 4, 'avg not taken');
  eq(c.diff, -2, 'diff = taken - notTaken');
  eq(c.daysTaken, 7, 'days taken');
  eq(c.daysNotTaken, 7, 'days not taken');
  eq(c.itemKind, 'supplement', 'kind carried through');
});

check('comparePattern withholds when data is too thin', () => {
  const days = twoSidedSymptomDays(2, 4);
  // Only 1 missed day — not enough for a comparison.
  const thirteenTaken = new Set<string>();
  for (let d = 1; d <= 13; d++) thirteenTaken.add(`2026-01-${String(d).padStart(2, '0')}`);
  eq(comparePattern('Headache', days, 'Magnesium', 'supplement', thirteenTaken), null, '1 not-taken day -> null');
  // No baseline on either side (3 vs 3).
  const threeTaken = new Set<string>();
  for (let d = 1; d <= 3; d++) threeTaken.add(`2026-01-${String(d).padStart(2, '0')}`);
  const sixDays = days.slice(0, 6);
  eq(comparePattern('Headache', sixDays, 'Magnesium', 'supplement', threeTaken), null, '3/3, no 7-day baseline -> null');
  // No symptom days at all.
  eq(comparePattern('Headache', [], 'Magnesium', 'supplement', itemDaysFor(true)), null, 'empty -> null');
});

check('comparePattern allows a regular taker with just a few missed days', () => {
  // 12 days taken, 2 missed — the requested case.
  const days: SymptomDay[] = [];
  const itemDays = new Set<string>();
  for (let d = 1; d <= 14; d++) {
    const key = `2026-01-${String(d).padStart(2, '0')}`;
    const taken = d <= 12;
    if (taken) itemDays.add(key);
    days.push({ day: key, severity: taken ? 2 : 4 });
  }
  const c = comparePattern('Headache', days, 'Magnesium', 'supplement', itemDays);
  if (!c) throw new Error('expected a comparison at 12 taken / 2 not taken');
  eq(c.daysTaken, 12, 'days taken');
  eq(c.daysNotTaken, 2, 'days not taken');
  eq(c.diff, -2, 'diff = taken - notTaken');
});

check('comparePattern allows the mirror: rarely-taken item with a solid baseline', () => {
  const days: SymptomDay[] = [];
  const itemDays = new Set<string>();
  for (let d = 1; d <= 14; d++) {
    const key = `2026-01-${String(d).padStart(2, '0')}`;
    const taken = d > 12;
    if (taken) itemDays.add(key);
    days.push({ day: key, severity: taken ? 2 : 4 });
  }
  const c = comparePattern('Headache', days, 'Magnesium', 'supplement', itemDays);
  if (!c) throw new Error('expected a comparison at 2 taken / 12 not taken');
  eq(c.daysTaken, 2, 'days taken');
  eq(c.daysNotTaken, 12, 'days not taken');
});

check('MIN_PATTERN_DAYS is 7 (deprecated alias)', () => {
  eq(MIN_PATTERN_DAYS, 7, 'threshold constant');
});

check('new pattern thresholds: 7-day baseline, 2-day minimum side', () => {
  eq(MIN_BASELINE_DAYS, 7, 'baseline');
  eq(MIN_COMPARISON_DAYS, 2, 'comparison minimum');
});

check('rankPatterns keeps top 3 by absolute diff, drops nulls', () => {
  const mk = (symptom: string, item: string, diff: number) => ({
    symptomName: symptom,
    itemName: item,
    itemKind: 'supplement' as const,
    avgTaken: 3 + diff,
    avgNotTaken: 3,
    diff,
    daysTaken: 10,
    daysNotTaken: 10,
  });
  const ranked = rankPatterns([
    mk('A', 'x', 0.5),
    null,
    mk('B', 'y', -2.0),
    mk('C', 'z', 1.0),
    mk('D', 'w', -0.2),
    mk('E', 'v', 3.0),
  ]);
  eq(ranked.map((r) => r.symptomName), ['E', 'B', 'C'], 'top 3 by |diff|');
  eq(ranked[0].absDiff, 3.0, 'absDiff on winner');
  eq(ranked.length, 3, 'default limit 3');
  eq(rankPatterns([mk('A', 'x', 0.5)], 1).length, 1, 'custom limit');
  eq(rankPatterns([null, null]).length, 0, 'all null -> empty');
});

check('filterWeightRange keeps trailing windows; -1 keeps all', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const pts = [
    { day: '2025-01-01', weight: 200, at: now - 400 * day },
    { day: '2026-09-01', weight: 190, at: now - 20 * day },
    { day: '2026-09-19', weight: 185, at: now - 1 * day },
  ];
  eq(filterWeightRange(pts, 30).length, 2, '30d keeps 2');
  eq(filterWeightRange(pts, 90).length, 2, '90d keeps 2');
  eq(filterWeightRange(pts, -1).length, 3, 'all keeps 3');
  eq(filterWeightRange([], 30).length, 0, 'empty stays empty');
});

check('filterSymptomRange keeps trailing windows; -1 keeps all', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const key = (daysAgo: number) => localDayKey(new Date(Date.now() - daysAgo * dayMs).toISOString());
  const days: SymptomDay[] = [
    { day: key(400), severity: 2 },
    { day: key(200), severity: 3 },
    { day: key(10), severity: 4 },
    { day: key(0), severity: 5 },
  ];
  eq(filterSymptomRange(days, 7).map((d) => d.severity), [5], 'week keeps today only');
  eq(filterSymptomRange(days, 30).map((d) => d.severity), [4, 5], 'month keeps 2');
  eq(filterSymptomRange(days, 90).map((d) => d.severity), [4, 5], '90 days keeps 2');
  eq(filterSymptomRange(days, 180).map((d) => d.severity), [4, 5], '6 months keeps 2');
  eq(filterSymptomRange(days, 365).map((d) => d.severity), [3, 4, 5], 'year keeps 3');
  eq(filterSymptomRange(days, -1).length, 4, 'all keeps everything');
  eq(filterSymptomRange([], 30).length, 0, 'empty stays empty');
});

check('summarizeWeights: current/min/max/change; null on empty', () => {
  const pts = [
    { day: '2026-09-01', weight: 190, at: 1 },
    { day: '2026-09-10', weight: 185, at: 2 },
    { day: '2026-09-19', weight: 187, at: 3 },
  ];
  const s = summarizeWeights(pts);
  if (!s) throw new Error('expected a summary');
  eq(s.current, 187, 'current = last');
  eq(s.min, 185, 'min');
  eq(s.max, 190, 'max');
  eq(s.change, -3, 'change = current - first');
  eq(summarizeWeights([{ day: '2026-09-19', weight: 187, at: 3 }])?.change, 0, 'single point change 0');
  eq(summarizeWeights([]), null, 'empty -> null');
});

// --- db query helpers ---

check('getWeightSeries returns oldest-first with local day keys', () => {
  setup();
  addWeightLog(190, iso(2026, 9, 10, 8));
  addWeightLog(185, iso(2026, 9, 1, 8));
  addWeightLog(187, iso(2026, 9, 19, 8));
  const series = getWeightSeries();
  eq(series.map((p) => p.weight), [185, 190, 187], 'oldest first');
  eq(series[0].day, '2026-09-01', 'local day key');
  ok(series.every((p) => p.at > 0), 'epochs present');
});

check('getSymptomDayMap averages multiple same-day entries', () => {
  setup();
  addSymptomLog('Headache', 2, '', iso(2026, 9, 1, 9));
  addSymptomLog('Headache', 4, '', iso(2026, 9, 1, 18));
  addSymptomLog('Headache', 5, '', iso(2026, 9, 2, 9));
  addSymptomLog('Fatigue', 3, '', iso(2026, 9, 1, 9));
  const m = getSymptomDayMap();
  eq(m.get('Headache'), [
    { day: '2026-09-01', severity: 3 },
    { day: '2026-09-02', severity: 5 },
  ], 'headache days averaged, oldest first');
  eq(m.get('Fatigue'), [{ day: '2026-09-01', severity: 3 }], 'fatigue separate');
});

check('getItemDayList groups med/supplement days by name, case-insensitive', () => {
  setup();
  addMedication('Magnesium', '', 1, '', false);
  addMedication('Vitamin D', '', 1, '', false);
  addSupplement('Fish Oil', '', 1, '', false);
  // medication ids are 1, 2; supplement id is 1
  addMedLog(1, iso(2026, 9, 1, 8));
  addMedLog(1, iso(2026, 9, 2, 8));
  addMedLog(2, iso(2026, 9, 1, 8));
  addSupplementLog(1, iso(2026, 9, 1, 9));
  addMedLog(1, iso(2026, 9, 3, 8));
  // A snapshot with different casing merges into the same entry.
  database().runSync(
    "INSERT INTO med_logs (medication_id, name, taken_at, quantity) VALUES (1, 'MAGNESIUM', ?, 1)",
    [iso(2026, 9, 4, 8)],
  );
  const list = getItemDayList();
  const mag = list.find((i) => i.kind === 'medication' && i.name === 'Magnesium');
  if (!mag) throw new Error('magnesium entry missing');
  eq([...mag.days].sort(), ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'], 'magnesium days, casing merged');
  const vitD = list.find((i) => i.name === 'Vitamin D');
  eq(vitD?.days.size, 1, 'vitamin D one day');
  const fish = list.find((i) => i.kind === 'supplement');
  eq(fish?.name, 'Fish Oil', 'supplement kind + name');
  eq(fish?.days.size, 1, 'fish oil one day');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
