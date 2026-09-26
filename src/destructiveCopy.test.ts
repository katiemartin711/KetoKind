// Tests for src/destructiveCopy.ts — the alert bodies for delete-all and
// import. Those alerts must name Pro (and import must say Pro is kept).
// Run with: npm test

import { DELETE_ALL_BODY, IMPORT_BODY } from './destructiveCopy';

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

check('delete-all and import copy name Pro', () => {
  ok(DELETE_ALL_BODY.includes('Pro'), 'DELETE_ALL_BODY contains Pro');
  ok(IMPORT_BODY.includes('Pro'), 'IMPORT_BODY contains Pro');
  ok(IMPORT_BODY.includes('except KetoKind Pro'), 'IMPORT_BODY contains except KetoKind Pro');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
