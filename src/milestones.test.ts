// Unit tests for src/milestones.ts — pure date logic, no React Native.
// Run with: npm test
// (tsc compiles this file + milestones.ts to dist-test/, node runs it.)

import {
  currentMilestone,
  dietDurationLabel,
  daysSinceDietStart,
  formatDietStart,
  parseDietStart,
  reachedMilestones,
  toDietStartString,
} from './milestones';

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

/** 'YYYY-MM-DD' for local noon N days ago (noon avoids DST-boundary flakiness). */
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// --- parseDietStart ---------------------------------------------------------
check('parses full date', () => {
  eq(parseDietStart('2024-03-14'), { year: 2024, month: 3, day: 14 }, 'full date');
});
check('parses month-only', () => {
  eq(parseDietStart('2024-03'), { year: 2024, month: 3, day: null }, 'month only');
});
check('rejects bad month', () => {
  eq(parseDietStart('2024-13'), null, 'month 13');
  eq(parseDietStart('2024-00'), null, 'month 0');
});
check('rejects impossible day', () => {
  eq(parseDietStart('2024-02-30'), null, 'Feb 30');
  eq(parseDietStart('2023-02-29'), null, 'Feb 29 non-leap');
});
check('accepts leap day', () => {
  eq(parseDietStart('2024-02-29')?.day, 29, 'Feb 29 leap year');
});
check('rejects garbage', () => {
  eq(parseDietStart(''), null, 'empty');
  eq(parseDietStart(null), null, 'null');
  eq(parseDietStart(undefined), null, 'undefined');
  eq(parseDietStart('not a date'), null, 'garbage');
  eq(parseDietStart('2024-3-5'), null, 'non-padded');
});

// --- toDietStartString ------------------------------------------------------
check('round-trips through toDietStartString', () => {
  eq(toDietStartString(2024, 3, 14), '2024-03-14', 'with day');
  eq(toDietStartString(2024, 3, null), '2024-03', 'month only');
  eq(parseDietStart(toDietStartString(2024, 3, 14)), { year: 2024, month: 3, day: 14 }, 'round trip');
});

// --- formatDietStart --------------------------------------------------------
check('formats dates for display', () => {
  eq(formatDietStart('2024-03-14'), 'March 14, 2024', 'with day');
  eq(formatDietStart('2024-03'), 'March 2024', 'month only');
  eq(formatDietStart(null), 'Not specified', 'null');
  eq(formatDietStart('garbage'), 'Not specified', 'garbage');
});

// --- daysSinceDietStart / dietDurationLabel ---------------------------------
check('duration labels', () => {
  eq(daysSinceDietStart(daysAgoStr(0)), 0, 'today');
  eq(dietDurationLabel(daysAgoStr(0)), 'started today', 'started today');
  eq(dietDurationLabel(daysAgoStr(1)), '1 day', '1 day');
  eq(dietDurationLabel(daysAgoStr(10)), '10 days', '10 days');
  eq(dietDurationLabel(daysAgoStr(45)), '1 month', '45 days');
  eq(dietDurationLabel(daysAgoStr(400)), '1 year 1 month', '400 days');
  eq(dietDurationLabel(null), null, 'null');
});
check('month-only start counts from the 1st', () => {
  const d = new Date();
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  eq(daysSinceDietStart(first), d.getDate() - 1, 'first of month');
});

// --- reachedMilestones / currentMilestone -----------------------------------
check('early milestones', () => {
  eq(reachedMilestones(daysAgoStr(10)).map((m) => m.key), ['d7'], '10 days -> d7');
  eq(reachedMilestones(daysAgoStr(200)).map((m) => m.key), ['d180', 'd90', 'd30', 'd7'], '200 days');
});
check('yearly milestones use 365-day multiples', () => {
  const keys = reachedMilestones(daysAgoStr(400)).map((m) => m.key);
  eq(keys, ['y1', 'd180', 'd90', 'd30', 'd7'], '400 days');
  eq(reachedMilestones(daysAgoStr(364)).some((m) => m.key === 'y1'), false, '364 days -> no y1');
});
check('no milestones without a start date', () => {
  eq(reachedMilestones(null), [], 'null');
  eq(reachedMilestones('garbage'), [], 'garbage');
});
check('dismissed milestones never come back', () => {
  const start = daysAgoStr(400);
  const dismissed = reachedMilestones(start).map((m) => m.key);
  eq(currentMilestone(start, dismissed), null, 'all dismissed');
  eq(currentMilestone(start, ['y1'])?.key, 'd180', 'newest dismissed -> next newest');
  eq(currentMilestone(start, [])?.key, 'y1', 'none dismissed -> newest');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
