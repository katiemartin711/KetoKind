// Food keyword matching tests: pure matching in src/foodGroups.ts.
// Run with: npm test

import { FOOD_GROUPS, expandFoodKeyword, matchFoodDays } from './foodGroups';
import type { FoodMatch } from './foodGroups';

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

/** Sorted day list out of a FoodMatch, for eq comparisons. */
function daysOf(m: FoodMatch): string[] {
  return [...m.daysWith].sort();
}

function meals(entries: [string, string[]][]): Map<string, string[]> {
  return new Map(entries);
}

const sample = () =>
  meals([
    ['2026-09-01', ['ground beef and eggs']],
    ['2026-09-02', ['bacon and eggs']],
    ['2026-09-03', ['ribeye with butter and salt']],
    ['2026-09-04', ['chicken thighs']],
  ]);

check('plain keyword matches case-insensitively', () => {
  const m = matchFoodDays('RIBEYE', sample());
  eq(daysOf(m), ['2026-09-03'], 'ribeye day');
  eq(m.matchedFoods, ['ribeye'], 'matchedFoods is the normalized keyword');
  eq(m.isGroup, false, 'not a group');
});

check('shorter form catches plurals', () => {
  const m = matchFoodDays('egg', sample());
  eq(daysOf(m), ['2026-09-01', '2026-09-02'], 'both egg days');
});

check('multi-word foods match as phrases', () => {
  const m = matchFoodDays('ground beef', sample());
  eq(daysOf(m), ['2026-09-01'], 'only the ground-beef day, not the bacon day');
});

check('group name expands to member foods', () => {
  const m = matchFoodDays('dairy', sample());
  eq(m.isGroup, true, 'dairy is a group');
  eq(m.matchedFoods, FOOD_GROUPS.dairy, 'matchedFoods are the group terms');
  eq(daysOf(m), ['2026-09-03'], 'butter day matches, egg days do not');
});

check('dairy expansion catches cheese and cream days', () => {
  const ms = meals([
    ['2026-09-10', ['cheese omelet']],
    ['2026-09-11', ['steak']],
    ['2026-09-12', ['coffee with cream']],
  ]);
  const m = matchFoodDays('dairy', ms);
  eq(daysOf(m), ['2026-09-10', '2026-09-12'], 'cheese and cream days');
});

check('singular group name still expands via plural fallback', () => {
  const m = matchFoodDays('egg', sample());
  eq(m.isGroup, true, 'egg finds the eggs group');
  const organ = matchFoodDays('organ meat', meals([['2026-09-05', ['beef liver and onions']]]));
  eq(organ.isGroup, true, 'organ meat finds the organ meats group');
  eq(daysOf(organ), ['2026-09-05'], 'liver day');
});

check('expandFoodKeyword returns null for plain keywords', () => {
  eq(expandFoodKeyword('ribeye'), null, 'ribeye is not a group');
  eq(expandFoodKeyword('kale'), null, 'kale is not a group');
});

check('empty keyword matches nothing', () => {
  const m = matchFoodDays('   ', sample());
  eq(daysOf(m), [], 'no days');
  eq(m.matchedFoods, [], 'no matched foods');
  eq(m.isGroup, false, 'not a group');
});

check('unmatched keyword matches nothing', () => {
  const m = matchFoodDays('kale', sample());
  eq(daysOf(m), [], 'no kale days');
  eq(m.isGroup, false, 'not a group');
});

check('multiple matching meals on one day count once', () => {
  const ms = meals([['2026-09-06', ['eggs for breakfast', 'egg drop soup for dinner']]]);
  const m = matchFoodDays('egg', ms);
  eq(daysOf(m), ['2026-09-06'], 'day counted once');
});

check('matching spans every meal text of the day', () => {
  const ms = meals([['2026-09-07', ['steak', 'butter coffee']]]);
  const m = matchFoodDays('butter', ms);
  eq(daysOf(m), ['2026-09-07'], 'second meal text searched too');
});

check('keyword is trimmed before matching', () => {
  const m = matchFoodDays('  bacon  ', sample());
  eq(daysOf(m), ['2026-09-02'], 'bacon day');
});

ok(FOOD_GROUPS.beef.includes('ribeye'), 'beef group has ribeye');
ok(FOOD_GROUPS.pork.includes('bacon'), 'pork group has bacon');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
