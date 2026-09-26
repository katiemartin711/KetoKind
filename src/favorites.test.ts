import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests, database } from './db/client';
import {
  deleteMealFavorite,
  findMealFavorite,
  listMealFavorites,
  saveMealFavorite,
} from './db/favorites';
import { deleteAllData } from './db/profile';
import { initDb } from './db/schema';
import { exportBackup, importBackup } from './db/backup';

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

function setup(): void {
  const handle = new NodeSqliteHandle();
  __setDbForTests(handle);
  initDb();
}

check('saving the same meal name updates one favorite', () => {
  setup();
  saveMealFavorite({
    name: '  6 eggs  ',
    mealType: 'Breakfast',
    notes: '',
    macros: { proteinG: 38, fatG: 30, carbsG: 2, fiberG: 0, netCarbsG: 2, calories: 430 },
    source: 'estimated',
  });
  saveMealFavorite({
    name: '6 Eggs',
    mealType: 'Breakfast',
    notes: 'with bacon',
    macros: null,
    source: '',
  });
  const rows = listMealFavorites();
  eq(rows.length, 1, 'one row');
  eq(rows[0].name, '6 Eggs', 'name updated');
  eq(rows[0].notes, 'with bacon', 'notes updated');
  eq(rows[0].protein_g, null, 'macros cleared on the second save');
  eq(findMealFavorite('6 eggs')?.id, rows[0].id, 'lookup ignores case');
});

check('removing a favorite and delete-all clear the list', () => {
  setup();
  saveMealFavorite({ name: 'Ribeye', mealType: 'Dinner', notes: '', macros: null, source: '' });
  const id = listMealFavorites()[0].id;
  deleteMealFavorite(id);
  eq(listMealFavorites().length, 0, 'removed');
  saveMealFavorite({ name: 'Ribeye', mealType: 'Dinner', notes: '', macros: null, source: '' });
  deleteAllData();
  eq(listMealFavorites().length, 0, 'delete-all');
});

check('favorites survive backup and an older file still imports', () => {
  setup();
  saveMealFavorite({
    name: 'Ribeye',
    mealType: 'Dinner',
    notes: '',
    macros: { proteinG: 50, fatG: 40, carbsG: 0, fiberG: 0, netCarbsG: 0, calories: 560 },
    source: 'edited',
  });
  const backup = exportBackup();
  eq(backup.mealFavorites?.length, 1, 'export includes the favorite');
  deleteAllData();
  importBackup(backup);
  eq(listMealFavorites()[0]?.name, 'Ribeye', 'import restores the favorite');
  const older = exportBackup();
  delete older.mealFavorites;
  deleteAllData();
  saveMealFavorite({ name: 'Temp', mealType: 'Snack', notes: '', macros: null, source: '' });
  importBackup(older);
  eq(listMealFavorites().length, 0, 'older backup clears favorites');
  eq(database().getAllSync('SELECT id FROM meal_favorites').length, 0, 'table empty');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
