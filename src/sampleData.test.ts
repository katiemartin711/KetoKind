// Demo backups use the current export shape: meal macros, favorite labels,
// dose quantities, and supplement links. Each file is one diet and 90 days.
import fs from 'fs';
import path from 'path';
import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests, database } from './db/client';
import { initDb } from './db/schema';
import { importBackup, isDatabaseBackup, validateBackup } from './db/backup';
import { listMealFavorites } from './db/favorites';
import { localDayKey } from './trendsStats';

const DIETS = ['keto', 'carnivore', 'lion', 'paleo'] as const;

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

function load(diet: (typeof DIETS)[number]): Record<string, unknown> {
  const file = path.join(__dirname, '..', 'sample-data', `ketokind-demo-${diet}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function daysOf(rows: { logged_at?: string; taken_at?: string }[], key: 'logged_at' | 'taken_at'): number {
  return new Set(rows.map((row) => localDayKey(String(row[key])))).size;
}

for (const diet of DIETS) {
  check(`${diet} demo matches the current backup format`, () => {
    const backup = load(diet);
    const issues = validateBackup(backup);
    if (issues.length > 0) {
      throw new Error(issues.slice(0, 5).map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    }
    ok(isDatabaseBackup(backup), 'validator accepts it');
    const profile = backup.profile as Record<string, unknown>;
    eq(profile.diet_type, diet, 'diet');
    eq(profile.track_calories, 1, 'calorie tracking is on');
    eq('is_pro' in profile, false, 'pro flag stays off the file');
    eq('llm_offer' in profile, false, 'download choice stays off the file');
    eq(typeof profile.reminder_settings, 'string', 'reminder settings field');

    const foods = backup.foodLogs as {
      logged_at: string;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
      fiber_g: number;
      net_carbs_g: number;
      calories: number;
      macro_source: string;
      name: string;
      notes: string;
    }[];
    eq(daysOf(foods, 'logged_at'), 90, 'food on 90 days');
    ok(
      foods.every(
        (row) =>
          typeof row.protein_g === 'number' &&
          typeof row.fat_g === 'number' &&
          typeof row.carbs_g === 'number' &&
          typeof row.fiber_g === 'number' &&
          typeof row.net_carbs_g === 'number' &&
          typeof row.calories === 'number' &&
          (row.macro_source === 'estimated' || row.macro_source === 'edited'),
      ),
      'every meal has macros and a source',
    );
    ok(foods.some((row) => row.macro_source === 'edited'), 'includes an edited meal');
    ok(foods.some((row) => row.macro_source === 'estimated'), 'includes an estimated meal');

    const symptoms = backup.symptomLogs as { logged_at: string }[];
    eq(daysOf(symptoms, 'logged_at'), 90, 'symptoms on 90 days');
    ok((backup.medLogs as unknown[]).length > 0, 'medication logs');
    ok((backup.supplementLogs as unknown[]).length > 0, 'supplement logs');
    ok(
      (backup.medLogs as { name: string; quantity: number }[]).every((row) => row.name !== '' && row.quantity >= 1),
      'med logs keep a name and quantity',
    );
    ok(
      (backup.supplementLogs as { supplement_id: number; quantity: number }[]).every(
        (row) => row.supplement_id >= 1 && row.quantity >= 1,
      ),
      'supplement logs link to the catalog and keep quantity',
    );

    const favorites = backup.mealFavorites as { label: string; name: string; protein_g: number }[];
    ok(favorites.length >= 3, 'favorites included');
    ok(favorites.some((row) => row.label.trim() !== ''), 'a favorite has a short name');
    ok(favorites.some((row) => row.label.trim() === ''), 'a favorite leaves the name blank');
    ok(favorites.every((row) => typeof row.protein_g === 'number'), 'favorites carry macros');

    const text = foods.map((row) => `${row.name} ${row.notes}`.toLowerCase()).join('\n');
    if (diet === 'lion') {
      for (const word of ['broccoli', 'spinach', 'cheese', 'cheddar', 'butter', 'bacon', 'salmon', 'chicken']) {
        ok(!text.includes(word), `lion meals skip ${word}`);
      }
    }
    if (diet === 'paleo' || diet === 'lion') {
      for (const word of ['cheddar', 'butter', 'heavy cream']) {
        ok(!text.includes(word), `${diet} meals skip ${word}`);
      }
    }
    if (diet === 'carnivore') {
      for (const word of ['broccoli', 'spinach', 'avocado', 'sweet potato', 'blueberries']) {
        ok(!text.includes(word), `carnivore meals skip ${word}`);
      }
    }

    const handle = new NodeSqliteHandle();
    __setDbForTests(handle);
    initDb();
    if (!isDatabaseBackup(backup)) throw new Error('unreachable');
    importBackup(backup);
    const stored = listMealFavorites();
    const named = favorites.find((row) => row.label.trim() !== '');
    eq(stored.find((row) => row.label === named?.label)?.name, named?.name, 'favorite name restored');
    const meal = database().getFirstSync<{ protein_g: number; macro_source: string; net_carbs_g: number }>(
      'SELECT protein_g, macro_source, net_carbs_g FROM food_logs WHERE id = 1',
    );
    eq(meal?.protein_g, foods[0].protein_g, 'protein restored');
    eq(meal?.net_carbs_g, foods[0].net_carbs_g, 'net carbs restored');
    eq(meal?.macro_source, foods[0].macro_source, 'macro source restored');
    handle.close();
  });
}

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
