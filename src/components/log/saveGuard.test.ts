// Synchronous in-flight guard for log saves. A second beginSave while the
// first is still open must not see the captured value, and finishSave either
// drops that value or puts it back.
// Run with: npm test

import { beginSave, finishSave, type SaveDraft } from './saveGuard';

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

check('beginSave returns the value once, then blocks', () => {
  const draft: SaveDraft<{ name: string }> = { saving: false, value: { name: 'eggs' } };
  const empty = { name: '' };
  const first = beginSave(draft, empty);
  eq(first, { ok: true, value: { name: 'eggs' } }, 'first result');
  eq(draft.saving, true, 'saving');
  eq(draft.value, empty, 'value emptied');
  const second = beginSave(draft, empty);
  eq(second, { ok: false }, 'second result');
});

check('finishSave(null) clears saving without putting the value back', () => {
  const draft: SaveDraft<{ name: string }> = { saving: false, value: { name: 'eggs' } };
  const previous = draft.value;
  beginSave(draft, { name: '' });
  finishSave(draft, null);
  eq(draft.saving, false, 'saving cleared');
  eq(draft.value, { name: '' }, 'value stays empty');
  eq(draft.value === previous, false, 'previous object not restored');
});

check('finishSave(previous) restores the value', () => {
  const previous = { name: 'eggs' };
  const draft: SaveDraft<{ name: string }> = { saving: false, value: previous };
  beginSave(draft, { name: '' });
  finishSave(draft, previous);
  eq(draft.saving, false, 'saving cleared');
  eq(draft.value, previous, 'value restored');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
