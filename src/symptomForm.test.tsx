// Component tests for SymptomForm suggestions (prior symptom name chips).
//
// Same plain-node + RNTL harness as medSuppForm.test.tsx — see that file
// and test/preload.js for the runner constraints.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests } from './db/client';
import { initDb } from './db/schema';
import { ThemeProvider } from './ThemeContext';
import SymptomForm from './components/log/SymptomForm';

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

type FormProps = React.ComponentProps<typeof SymptomForm>;

function baseProps(overrides: Partial<FormProps> = {}): FormProps {
  return {
    symptomName: '',
    onSymptomNameChange: () => {},
    priorNames: ['Headache', 'Bloating', 'Low energy'],
    severity: 3,
    onSeverityChange: () => {},
    symptomNotes: '',
    onSymptomNotesChange: () => {},
    logDate: new Date(2026, 8, 20, 12, 0),
    onLogDateChange: () => {},
    editing: false,
    onSave: () => {},
    onCancel: () => {},
    ...overrides,
  };
}

function renderForm(props: FormProps) {
  return render(
    <ThemeProvider>
      <SymptomForm {...props} />
    </ThemeProvider>,
  );
}

check('shows prior names when the field is empty', () => {
  const { getByText, queryByText } = renderForm(baseProps());
  ok(getByText('From your logs') != null, 'hint label');
  ok(getByText('Headache') != null, 'Headache chip');
  ok(getByText('Bloating') != null, 'Bloating chip');
  ok(getByText('Low energy') != null, 'Low energy chip');
  eq(queryByText('From your logs') != null, true, 'suggestions visible');
});

check('filters chips as the user types', () => {
  const { getByText, queryByText } = renderForm(baseProps({ symptomName: 'blo' }));
  ok(getByText('Bloating') != null, 'Bloating still shown');
  eq(queryByText('Headache'), null, 'Headache filtered out');
});

check('hides chips when the typed name exactly matches a prior name', () => {
  const { queryByText } = renderForm(baseProps({ symptomName: 'Headache' }));
  eq(queryByText('From your logs'), null, 'no suggestion block');
  eq(queryByText('Bloating'), null, 'siblings also gone when only exact left');
});

check('tapping a suggestion fills the name', () => {
  let value = '';
  const { getByLabelText } = renderForm(
    baseProps({
      onSymptomNameChange: (s) => {
        value = s;
      },
    }),
  );
  fireEvent.press(getByLabelText('Use symptom name Bloating'));
  eq(value, 'Bloating', 'chip writes the prior label');
});

check('no prior names → no suggestion UI', () => {
  const { queryByText } = renderForm(baseProps({ priorNames: [] }));
  eq(queryByText('From your logs'), null, 'hint hidden');
});

console.log(`symptomForm.test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
