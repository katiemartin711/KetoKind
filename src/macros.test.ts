import { estimateMealMacros } from './foodEstimate';
import { finalizeMacros, formatMacroSummary, macroFieldsBlank, parseMacroJson, parseUserMacros, plausibleMacroEstimate } from './macros';
import { planMealSave } from './llmOffer';
import { acceptNarrative, compareMacroBalance, macroFingerprint } from './macroCorrelations';
import type { SymptomDay } from './trendsStats';
import type { MacroDay } from './macroCorrelations';

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

check('parseMacroJson computes net carbs and ignores model net carbs', () => {
  const parsed = parseMacroJson('Sure.\n{"protein_g":30,"fat_g":20,"carbs_g":10,"fiber_g":4,"calories":350,"net_carbs_g":99}');
  eq(parsed?.netCarbsG, 6, 'net');
  eq(parsed?.proteinG, 30, 'protein');
  eq(parsed?.calories, 350, 'calories');
});

check('parseMacroJson rejects junk and clamps fiber to carbs', () => {
  eq(parseMacroJson('not json'), null, 'junk');
  const parsed = finalizeMacros(10, 10, 5, 9, 100);
  eq(parsed?.fiberG, 5, 'fiber clamped');
  eq(parsed?.netCarbsG, 0, 'net floor');
  eq(finalizeMacros(-1, 1, 1, 0, 10), null, 'negative');
});

check('user macros: blank vs partial vs complete', () => {
  const blank = { protein: '', fat: '', carbs: '', fiber: '', calories: '' };
  ok(macroFieldsBlank(blank, false), 'blank without calories');
  ok(macroFieldsBlank({ ...blank, calories: '100' }, false), 'calories ignored when tracking off');
  eq(macroFieldsBlank({ ...blank, calories: '100' }, true), false, 'calories count when tracking on');
  const partial = parseUserMacros({ ...blank, protein: '10' }, false);
  eq(partial.ok, false, 'partial rejected');
  const full = parseUserMacros({ protein: '25', fat: '15', carbs: '8', fiber: '3', calories: '' }, false);
  ok(full.ok && full.macros.netCarbsG === 5, 'net from user carbs and fiber');
});

check('portion table totals eggs, thick bacon, and a fraction of a cup', () => {
  const meal = estimateMealMacros('6 eggs, 3 strips of thick cut bacon, 1/3 cup butter', '');
  ok(meal != null && meal.proteinG > 45 && meal.proteinG < 55, 'protein near 50g');
  ok(meal != null && meal.fatG > 100, 'fat includes the butter');
  eq(estimateMealMacros('something unlisted', ''), null, 'unknown food skips the table');
  const tiny = { proteinG: 1.5, fatG: 0.5, carbsG: 1.5, fiberG: 0.5, netCarbsG: 1, calories: 20 };
  eq(plausibleMacroEstimate(tiny, '6 eggs, 3 strips of thick cut bacon'), false, 'placeholder grams rejected');
});

check('formatMacroSummary hides calories until tracking is on', () => {
  eq(
    formatMacroSummary(20, 10, 3, 400, 'estimated', false),
    'P 20g · F 10g · net C 3g (est.)',
    'no calories',
  );
  eq(
    formatMacroSummary(20, 10, 3, 400, 'edited', true),
    'P 20g · F 10g · net C 3g · 400 kcal (edited)',
    'with calories',
  );
});

check('meal save plan: estimate, prompt once, then stay quiet', () => {
  eq(
    planMealSave({ modelReady: false, nativeAvailable: true, offer: '', userEditedMacros: false }),
    'prompt-download',
    'first save asks',
  );
  eq(
    planMealSave({ modelReady: false, nativeAvailable: true, offer: 'declined', userEditedMacros: false }),
    'save-only',
    'decline does not nag',
  );
  eq(
    planMealSave({ modelReady: true, nativeAvailable: true, offer: 'declined', userEditedMacros: false }),
    'estimate',
    'downloaded later still estimates',
  );
  eq(
    planMealSave({ modelReady: true, nativeAvailable: true, offer: '', userEditedMacros: true }),
    'save-only',
    'typed macros skip the model',
  );
  eq(
    planMealSave({ modelReady: false, nativeAvailable: false, offer: '', userEditedMacros: false }),
    'save-only',
    'Expo Go still saves',
  );
});

function days(severities: number[]): SymptomDay[] {
  return severities.map((severity, i) => ({
    day: `2026-01-${String(i + 1).padStart(2, '0')}`,
    severity,
  }));
}

function macros(n: number, net: (i: number) => number): Map<string, MacroDay> {
  const map = new Map<string, MacroDay>();
  for (let i = 0; i < n; i++) {
    const day = `2026-01-${String(i + 1).padStart(2, '0')}`;
    map.set(day, { day, proteinG: 80, fatG: 100, netCarbsG: net(i), calories: 1800 });
  }
  return map;
}

check('macro comparison withholds thin data and splits on the median', () => {
  eq(compareMacroBalance('Headache', days([3, 3, 3]), macros(3, () => 5), 'netCarbs'), null, 'thin');
  const sev = [1, 1, 1, 1, 1, 1, 1, 4, 4, 4];
  const compared = compareMacroBalance(
    'Headache',
    days(sev),
    macros(10, (i) => (i < 7 ? 5 : 40)),
    'netCarbs',
  );
  ok(compared != null && compared.avgHigh > compared.avgLow, 'higher net-carb days average higher');
  ok(compared != null && compared.daysHigh >= 2 && compared.daysLow >= 7, 'day floors');
  eq(
    compareMacroBalance('Headache', days(Array(10).fill(2)), macros(10, () => 8), 'protein'),
    null,
    'no split when every day matches',
  );
});

check('narrative acceptance drops advice and fingerprints change with the stats', () => {
  eq(acceptNarrative('too short'), null, 'short');
  eq(acceptNarrative('You should stop taking your medication based on these logs today.'), null, 'advice');
  const okText = 'In your logs, headache severity averaged higher on higher net-carb days than on lower ones.';
  eq(acceptNarrative(okText), okText, 'plain pattern');
  const a = compareMacroBalance('Headache', days([1, 1, 1, 1, 1, 1, 1, 4, 4, 4]), macros(10, (i) => (i < 7 ? 4 : 30)), 'netCarbs');
  const b = compareMacroBalance('Headache', days([2, 2, 2, 2, 2, 2, 2, 4, 4, 4]), macros(10, (i) => (i < 7 ? 4 : 30)), 'netCarbs');
  ok(a != null && b != null && macroFingerprint([a]) !== macroFingerprint([b]), 'fingerprint');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
