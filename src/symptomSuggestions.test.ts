// Pure filter for Log-tab symptom name suggestions.
import { filterSymptomSuggestions } from './components/log/symptomSuggestions';

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

const NAMES = ['Headache', 'Bloating', 'Low energy', 'Brain fog', 'Cramps'];

check('empty query returns the leading names up to the limit', () => {
  eq(filterSymptomSuggestions(NAMES, ''), NAMES, 'all when under limit');
  eq(filterSymptomSuggestions(NAMES, '  ', 3), ['Headache', 'Bloating', 'Low energy'], 'limit 3');
});

check('substring match is case-insensitive', () => {
  eq(filterSymptomSuggestions(NAMES, 'head'), ['Headache'], 'head → Headache');
  eq(filterSymptomSuggestions(NAMES, 'BLO'), ['Bloating'], 'BLO → Bloating');
  eq(filterSymptomSuggestions(NAMES, 'ain'), ['Brain fog'], 'ain → Brain fog');
});

check('exact match (any case) is hidden so the chip is not redundant', () => {
  eq(filterSymptomSuggestions(NAMES, 'Headache'), [], 'exact gone');
  eq(filterSymptomSuggestions(NAMES, 'headache'), [], 'case-insensitive exact');
  eq(filterSymptomSuggestions(NAMES, ' bloating '), [], 'trimmed exact');
});

check('partial match can still surface siblings', () => {
  // "Low" matches "Low energy" exactly after trim? No — query "Low" !== "low energy"
  eq(filterSymptomSuggestions(NAMES, 'Low'), ['Low energy'], 'prefix still shows full name');
});

check('no matches → empty', () => {
  eq(filterSymptomSuggestions(NAMES, 'zzz'), [], 'no hit');
  eq(filterSymptomSuggestions([], 'head'), [], 'empty catalog');
});

console.log(`symptomSuggestions.test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
