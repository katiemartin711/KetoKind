// Clear control on the meal form after a favorite (or any typed meal) fills it.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests } from './db/client';
import { initDb } from './db/schema';
import { ThemeProvider } from './ThemeContext';
import MealForm from './components/log/MealForm';

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

type FormProps = React.ComponentProps<typeof MealForm>;

function baseProps(overrides: Partial<FormProps> = {}): FormProps {
  return {
    mealName: '',
    onMealNameChange: () => {},
    mealType: 'Dinner',
    onMealTypeChange: () => {},
    mealNotes: '',
    onMealNotesChange: () => {},
    logDate: new Date(2026, 8, 20, 12, 0),
    onLogDateChange: () => {},
    editing: false,
    onSave: () => {},
    onCancel: () => {},
    trackCalories: false,
    protein: '',
    fat: '',
    carbs: '',
    fiber: '',
    calories: '',
    onProteinChange: () => {},
    onFatChange: () => {},
    onCarbsChange: () => {},
    onFiberChange: () => {},
    onCaloriesChange: () => {},
    estimating: false,
    favorite: false,
    onFavoriteChange: () => {},
    favoriteLabel: '',
    onFavoriteLabelChange: () => {},
    favorites: [],
    onUseFavorite: () => {},
    onRemoveFavorite: () => {},
    ...overrides,
  };
}

function renderForm(props: FormProps) {
  return render(
    <ThemeProvider>
      <MealForm {...props} />
    </ThemeProvider>,
  );
}

check('an empty meal form has no clear button', () => {
  const { queryByText } = renderForm(baseProps());
  eq(queryByText('Clear form'), null, 'clear hidden');
});

check('a filled meal, including one from a favorite, can be cleared', () => {
  let cleared = 0;
  const { getByText } = renderForm(
    baseProps({
      mealName: '6 eggs, 3 strips of thick cut bacon',
      mealType: 'Breakfast',
      favorite: true,
      favoriteLabel: 'Usual breakfast',
      onCancel: () => {
        cleared += 1;
      },
    }),
  );
  fireEvent.press(getByText('Clear form'));
  eq(cleared, 1, 'clear resets the form');
});

check('editing keeps cancel and hides clear', () => {
  const { getByText, queryByText } = renderForm(baseProps({ mealName: 'Ribeye', editing: true }));
  ok(getByText('Cancel editing') != null, 'cancel visible');
  eq(queryByText('Clear form'), null, 'clear hidden while editing');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`mealForm.test: ${passed} passed, ${failed} failed`);
