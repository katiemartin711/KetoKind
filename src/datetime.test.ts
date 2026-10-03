// Tests for local calendar keys in src/datetime.ts.
// Run with: npm test

import { dayKey } from './datetime';
import { localDayKey } from './trendsStats';

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

check('dayKey pads a local calendar date', () => {
  const iso = '2026-01-05T15:00:00.000Z';
  eq(dayKey(iso).split('-')[1] !== '0', true, 'month is not 0-based');
  eq(dayKey(iso), localDayKey(iso), 'matches localDayKey');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
