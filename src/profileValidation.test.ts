// Tests for src/profileValidation.ts — the exact validation rules behind the
// Profile tab's save action (extracted from ProfileScreen.onSave).
// Run with: npm test

import { validateProfileInputs } from './profileValidation';

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

const BLANK = { month: '', day: '', year: '' };

check('blank age and blank diet start is valid', () => {
  const r = validateProfileInputs('', BLANK);
  eq(r, { ok: true, age: null, dietStart: null }, 'all blank');
  const r2 = validateProfileInputs('   ', BLANK);
  eq(r2.ok, true, 'whitespace age treated as blank');
});

check('age accepts 1..120 and rejects the rest', () => {
  eq(validateProfileInputs('1', BLANK), { ok: true, age: 1, dietStart: null }, 'min');
  eq(validateProfileInputs('120', BLANK), { ok: true, age: 120, dietStart: null }, 'max');
  const zero = validateProfileInputs('0', BLANK);
  ok(!zero.ok && zero.message.includes('between 1 and 120'), 'zero rejected');
  const high = validateProfileInputs('121', BLANK);
  ok(!high.ok, '121 rejected');
  const junk = validateProfileInputs('12abc', BLANK);
  ok(!junk.ok, '"12abc" rejected by strict parsing');
  const neg = validateProfileInputs('-5', BLANK);
  ok(!neg.ok, 'negative rejected');
});

check('diet start requires month and year together', () => {
  const monthOnly = validateProfileInputs('', { month: '3', day: '', year: '' });
  ok(
    !monthOnly.ok && monthOnly.message.includes('month and year'),
    'month without year rejected',
  );
  const yearOnly = validateProfileInputs('', { month: '', day: '', year: '2024' });
  ok(!yearOnly.ok, 'year without month rejected');
  const dayOnly = validateProfileInputs('', { month: '', day: '15', year: '' });
  ok(!dayOnly.ok, 'day alone rejected');
});

check('diet start accepts month+year and optional day', () => {
  const r = validateProfileInputs('', { month: '3', day: '', year: '2024' });
  eq(r, { ok: true, age: null, dietStart: '2024-03' }, 'month+year, no day');
  const r2 = validateProfileInputs('', { month: '3', day: '15', year: '2024' });
  eq(r2, { ok: true, age: null, dietStart: '2024-03-15' }, 'full date');
});

check('diet start rejects bad month, year, and day values', () => {
  ok(!validateProfileInputs('', { month: '13', day: '', year: '2024' }).ok, 'month 13');
  ok(!validateProfileInputs('', { month: '0', day: '', year: '2024' }).ok, 'month 0');
  ok(!validateProfileInputs('', { month: '3abc', day: '', year: '2024' }).ok, 'month junk');
  ok(!validateProfileInputs('', { month: '3', day: '', year: '1989' }).ok, 'year before 1990');
  const nowYear = new Date().getFullYear();
  const futureYear = validateProfileInputs('', {
    month: '3',
    day: '',
    year: String(nowYear + 1),
  });
  ok(!futureYear.ok, 'year after current rejected');
  ok(
    !validateProfileInputs('', { month: '2', day: '30', year: '2024' }).ok,
    'Feb 30 rejected',
  );
  eq(
    validateProfileInputs('', { month: '2', day: '29', year: '2024' }),
    { ok: true, age: null, dietStart: '2024-02-29' },
    'Feb 29 accepted in a leap year',
  );
  ok(!validateProfileInputs('', { month: '4', day: '31', year: '2024' }).ok, 'Apr 31 rejected');
});

check('diet start rejects dates in the future', () => {
  // Tomorrow is always in the future; it lands in the current year unless
  // today is Dec 31, in which case the year-range rule rejects it instead.
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const r = validateProfileInputs('', {
    month: String(t.getMonth() + 1),
    day: String(t.getDate()),
    year: String(t.getFullYear()),
  });
  ok(!r.ok, 'tomorrow rejected as diet start');
  if (!r.ok && t.getFullYear() === new Date().getFullYear()) {
    ok(r.message.includes('future'), 'same-year future date gets the future message');
  }
});

check('age and diet start validate together', () => {
  const r = validateProfileInputs('32', { month: '1', day: '5', year: '2023' });
  eq(r, { ok: true, age: 32, dietStart: '2023-01-05' }, 'both valid');
  const badAge = validateProfileInputs('0', { month: '1', day: '5', year: '2023' });
  ok(!badAge.ok, 'bad age fails even with good date');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
