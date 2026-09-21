// Tests for the med/supp selection state machine (src/components/log/
// medSuppSelection.ts) — the edit-mode locking and quantity bookkeeping that
// used to live as four intertwined useState hooks in LogScreen.
// Run with: npm test

import {
  initialMedSuppSelection,
  medSuppSelectionReducer,
  type MedSuppSelectionState,
} from './components/log/medSuppSelection';

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

function reduce(
  state: MedSuppSelectionState,
  action: Parameters<typeof medSuppSelectionReducer>[1],
): MedSuppSelectionState {
  return medSuppSelectionReducer(state, action);
}

check('toggling a med selects then deselects it', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: null });
  eq(s.selectedMedIds, [1], 'selected');
  eq(s.medQty[1], 1, 'qty initialized to 1');
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: null });
  eq(s.selectedMedIds, [], 'deselected');
  eq(1 in s.medQty, false, 'qty dropped on deselect');
});

check('multi-select accumulates meds and supps independently', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: null });
  s = reduce(s, { type: 'toggle-med', id: 2, editingKind: null });
  s = reduce(s, { type: 'toggle-supp', id: 9, editingKind: null });
  eq(s.selectedMedIds, [1, 2], 'two meds');
  eq(s.selectedSuppIds, [9], 'one supp');
  eq(s.medQty[2], 1, 'second med qty initialized');
});

check('medication edit locks supplements out entirely', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-supp', id: 9, editingKind: null });
  const before = s;
  s = reduce(s, { type: 'toggle-supp', id: 9, editingKind: 'medication' });
  eq(s, before, 'supp toggle is a no-op while editing a medication');
  s = reduce(s, { type: 'toggle-supp', id: 10, editingKind: 'medication' });
  eq(s.selectedSuppIds, [9], 'new supp cannot be selected while editing a medication');
});

check('supplement edit locks medications out entirely', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: null });
  const before = s;
  s = reduce(s, { type: 'toggle-med', id: 2, editingKind: 'supplement' });
  eq(s, before, 'med toggle is a no-op while editing a supplement');
});

check('medication edit replaces (single-select) instead of accumulating', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: 'medication' });
  eq(s.selectedMedIds, [1], 'first med selected');
  s = reduce(s, { type: 'toggle-med', id: 2, editingKind: 'medication' });
  eq(s.selectedMedIds, [2], 'second med replaces the first while editing');
});

check('supplement edit replaces (single-select) instead of accumulating', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-supp', id: 9, editingKind: 'supplement' });
  s = reduce(s, { type: 'toggle-supp', id: 10, editingKind: 'supplement' });
  eq(s.selectedSuppIds, [10], 'second supp replaces the first while editing');
});

check('qty bumps clamp to 1..20', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'bump-qty', kind: 'med', id: 1, delta: -5 });
  eq(s.medQty[1], 1, 'cannot go below 1');
  s = reduce(s, { type: 'bump-qty', kind: 'supp', id: 9, delta: 100 });
  eq(s.suppQty[9], 20, 'cannot exceed 20');
  s = reduce(s, { type: 'bump-qty', kind: 'supp', id: 9, delta: -3 });
  eq(s.suppQty[9], 17, 'decrements from clamped value');
});

check('prune drops selections whose profile entry was deleted', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: null });
  s = reduce(s, { type: 'toggle-med', id: 2, editingKind: null });
  s = reduce(s, { type: 'toggle-supp', id: 9, editingKind: null });
  s = reduce(s, { type: 'prune', validMedIds: [2], validSuppIds: [] });
  eq(s.selectedMedIds, [2], 'deleted med pruned');
  eq(s.selectedSuppIds, [], 'deleted supp pruned');
});

check('load-selection restores a saved entry for editing', () => {
  const s = reduce(initialMedSuppSelection, {
    type: 'load-selection',
    medIds: [4],
    suppIds: [],
    medQty: { 4: 3 },
    suppQty: {},
  });
  eq(s.selectedMedIds, [4], 'med restored');
  eq(s.medQty[4], 3, 'qty restored');
});

check('reset returns to the initial empty selection', () => {
  let s = initialMedSuppSelection;
  s = reduce(s, { type: 'toggle-med', id: 1, editingKind: null });
  s = reduce(s, { type: 'toggle-supp', id: 9, editingKind: null });
  s = reduce(s, { type: 'reset' });
  eq(s, initialMedSuppSelection, 'back to initial');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
