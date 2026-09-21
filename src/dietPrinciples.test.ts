// Structural tests for dietPrinciples(): every diet gets 10 principles, and the
// per-diet overrides never contradict the diet (e.g. no "dairy is optional"
// for Lion Diet or paleo). Run with: npm test

import { dietPrinciples } from './dietPrinciples';
import { DIET_TYPES } from './types';

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

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`expected truthy: ${label}`);
}

function eq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

for (const diet of DIET_TYPES) {
  check(`${diet}: returns 10 non-empty principles`, () => {
    const ps = dietPrinciples(diet);
    eq(ps.length, 10, 'count');
    for (const p of ps) ok(p.trim().length > 0, 'non-empty');
  });
}

check('keto and carnivore share the base list', () => {
  eq(dietPrinciples('keto'), dietPrinciples('carnivore'), 'identical');
  ok(
    dietPrinciples('keto')[7].includes('Dairy is optional'),
    'base dairy principle intact',
  );
});

check('lion: no dairy, ruminant-meat foundation', () => {
  const ps = dietPrinciples('lion');
  const all = ps.join('\n');
  ok(!all.includes('Dairy is optional'), 'no "dairy is optional"');
  ok(all.includes('No dairy'), 'dairy excluded');
  ok(!ps[1].includes('butter'), 'fat principle does not recommend butter');
  ok(ps[0].includes('Ruminant meat'), 'ruminant foundation');
});

check('paleo: whole-food carbs allowed, no dairy', () => {
  const ps = dietPrinciples('paleo');
  const all = ps.join('\n');
  ok(!all.includes('Dairy is optional'), 'no "dairy is optional"');
  ok(all.includes('No dairy'), 'dairy excluded');
  ok(all.includes('tubers') && all.includes('fruit'), 'whole-food carbs acknowledged');
  ok(!all.includes('BBBe'), 'no butter-based reset');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
