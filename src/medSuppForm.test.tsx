// Component tests for MedSuppForm (the Log tab's medication/supplement picker).
//
// Runs under plain node — no jest, no RN runtime. `node -r ./test/preload.js`
// (see package.json "test") shims react-native and the native date/time
// picker; the db is the same in-memory node:sqlite handle the db tests use.
// Only RNTL's synchronous APIs are used (render/screen/fireEvent): the
// async queries need jest's fake timers, which don't exist here.
//
// These tests assert rendered behavior (chips, disabled states, button
// labels, stepper callbacks). The selection state machine itself is covered
// without rendering in src/medSuppSelection.test.ts.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests } from './db/client';
import { initDb } from './db/schema';
import { ThemeProvider } from './ThemeContext';
import MedSuppForm from './components/log/MedSuppForm';
import type { Medication, Supplement } from './types';

__setDbForTests(new NodeSqliteHandle());
initDb();

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

type FormProps = React.ComponentProps<typeof MedSuppForm>;

const MEDS: Medication[] = [
  { id: 1, name: 'Magnesium', dosage: '400mg', times_per_day: 1, purpose: 'sleep', as_needed: 0 },
  { id: 2, name: 'Electrolytes', dosage: '', times_per_day: 0, purpose: 'hydration', as_needed: 1 },
];
const SUPPS: Supplement[] = [
  { id: 9, name: 'Vitamin D3', dosage: '5000 IU', times_per_day: 1, purpose: 'immune', as_needed: 0 },
];

function baseProps(overrides: Partial<FormProps> = {}): FormProps {
  return {
    medications: MEDS,
    profileSupps: SUPPS,
    selectedMedIds: [],
    selectedSuppIds: [],
    medQty: {},
    suppQty: {},
    onToggleMed: () => {},
    onToggleSupp: () => {},
    onBumpQty: () => {},
    logDate: new Date(2026, 8, 20, 12, 0),
    onLogDateChange: () => {},
    editingKind: null,
    onSave: () => {},
    onCancel: () => {},
    ...overrides,
  };
}

function renderForm(props: FormProps) {
  return render(
    <ThemeProvider>
      <MedSuppForm {...props} />
    </ThemeProvider>,
  );
}

/** The TouchableOpacity wrapping a chip's label text. */
function chipButton(getByText: (t: string) => React.ReactElement, label: string) {
  const el = getByText(label) as unknown as { parent: React.ReactElement };
  return el.parent;
}

check('renders medication and supplement chips', () => {
  const { getByText } = renderForm(baseProps());
  ok(getByText('Magnesium (400mg)') != null, 'med chip with dosage');
  ok(getByText('Electrolytes · as needed') != null, 'as-needed med chip');
  ok(getByText('Vitamin D3 (5000 IU)') != null, 'supp chip');
});

check('save button is disabled until something is selected', () => {
  const { getByText } = renderForm(baseProps());
  const saveText = getByText('Mark selected as taken') as unknown as {
    parent: { props: { disabled: boolean } };
  };
  eq(saveText.parent.props.disabled, true, 'disabled with no selection');

  const { getByText: getByText2 } = renderForm(baseProps({ selectedMedIds: [1] }));
  const saveText2 = getByText2('Mark selected as taken') as unknown as {
    parent: { props: { disabled: boolean } };
  };
  eq(saveText2.parent.props.disabled, false, 'enabled with a selection');
});

check('tapping a chip calls onToggleMed with the id', () => {
  const toggled: number[] = [];
  const { getByText } = renderForm(baseProps({ onToggleMed: (id) => toggled.push(id) }));
  fireEvent.press(chipButton(getByText, 'Magnesium (400mg)') as never);
  eq(toggled, [1], 'med toggle fired');
});

check('tapping a chip calls onToggleSupp with the id', () => {
  const toggled: number[] = [];
  const { getByText } = renderForm(baseProps({ onToggleSupp: (id) => toggled.push(id) }));
  fireEvent.press(chipButton(getByText, 'Vitamin D3 (5000 IU)') as never);
  eq(toggled, [9], 'supp toggle fired');
});

check('editing a supplement locks the medication chips', () => {
  const { getByText, queryByText } = renderForm(
    baseProps({ editingKind: 'supplement', selectedSuppIds: [9] }),
  );
  const medChip = chipButton(getByText, 'Magnesium (400mg)') as unknown as {
    props: { disabled: boolean };
  };
  eq(medChip.props.disabled, true, 'med chip disabled while editing a supplement');
  const suppChip = chipButton(getByText, 'Vitamin D3 (5000 IU)') as unknown as {
    props: { disabled: boolean };
  };
  eq(suppChip.props.disabled, false, 'supp chip stays enabled');
  ok(getByText('Save changes') != null, 'save button relabeled in edit mode');
  ok(getByText('Cancel editing') != null, 'cancel editing visible in edit mode');
  ok(queryByText('Mark selected as taken') == null, 'default save label gone in edit mode');
});

check('editing a medication locks the supplement chips', () => {
  const { getByText } = renderForm(
    baseProps({ editingKind: 'medication', selectedMedIds: [1] }),
  );
  const suppChip = chipButton(getByText, 'Vitamin D3 (5000 IU)') as unknown as {
    props: { disabled: boolean };
  };
  eq(suppChip.props.disabled, true, 'supp chip disabled while editing a medication');
});

check('as-needed selection shows a qty stepper that bumps qty', () => {
  const bumped: Array<[string, number, number]> = [];
  const { getByText, getByLabelText } = renderForm(
    baseProps({
      selectedMedIds: [2],
      medQty: { 2: 1 },
      onBumpQty: (kind, id, delta) => bumped.push([kind, id, delta]),
    }),
  );
  ok(getByText('How many?') != null, 'qty section appears');
  ok(getByText('1') != null, 'current qty shown');
  const inc = getByLabelText('Take one more Electrolytes');
  fireEvent.press(inc as never);
  eq(bumped, [['med', 2, 1]], 'increment fired with (med, id, +1)');
  const dec = getByLabelText('Take one fewer Electrolytes');
  fireEvent.press(dec as never);
  eq(bumped, [['med', 2, 1], ['med', 2, -1]], 'decrement fired with (med, id, -1)');
});

check('scheduled items never get a qty stepper', () => {
  const { queryByText } = renderForm(baseProps({ selectedMedIds: [1], medQty: { 1: 1 } }));
  ok(queryByText('How many?') == null, 'no qty section for scheduled meds');
});

check('empty profile sections show the add-on-profile hint', () => {
  const { getByText } = renderForm(baseProps({ medications: [], profileSupps: [] }));
  ok(getByText('No medications yet — add them on the Profile tab first.') != null, 'med hint');
  ok(getByText('No supplements yet — add them on the Profile tab first.') != null, 'supp hint');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
