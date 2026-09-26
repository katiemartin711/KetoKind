// Meal macros: parsing model output and optional user edits.
// Net carbs are always computed here (total carbs − fiber) so the model
// cannot disagree with the number the Trends tab correlates on.

export interface MacroGrams {
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  netCarbsG: number;
  calories: number | null;
}

export type MacroSource = 'estimated' | 'edited';

const MAX_GRAMS = 800;
const MAX_CALORIES = 8000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function inRange(n: number, max: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= max;
}

/** Clamp fiber to total carbs and derive net carbs. Returns null on junk. */
export function finalizeMacros(
  proteinG: number,
  fatG: number,
  carbsG: number,
  fiberG: number,
  calories: number | null,
): MacroGrams | null {
  if (!inRange(proteinG, MAX_GRAMS) || !inRange(fatG, MAX_GRAMS) || !inRange(carbsG, MAX_GRAMS)) {
    return null;
  }
  if (!inRange(fiberG, MAX_GRAMS)) return null;
  if (calories != null && !inRange(calories, MAX_CALORIES)) return null;
  const fiber = Math.min(fiberG, carbsG);
  return {
    proteinG: round1(proteinG),
    fatG: round1(fatG),
    carbsG: round1(carbsG),
    fiberG: round1(fiber),
    netCarbsG: round1(Math.max(0, carbsG - fiber)),
    calories: calories == null ? null : round1(calories),
  };
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Pull a macro object out of model text. Accepts raw JSON or JSON wrapped
 * in extra prose. Net carbs are computed, not trusted from the model.
 */
export function parseMacroJson(text: string): MacroGrams | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const protein = num(o.protein_g ?? o.protein);
  const fat = num(o.fat_g ?? o.fat);
  const carbs = num(o.carbs_g ?? o.carbs ?? o.total_carbs_g);
  const fiber = num(o.fiber_g ?? o.fiber) ?? 0;
  const calories = num(o.calories ?? o.kcal);
  if (protein == null || fat == null || carbs == null) return null;
  return finalizeMacros(protein, fat, carbs, fiber, calories);
}

export interface MacroFieldInput {
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  calories: string;
}

/** True when every macro field is blank (the model may estimate instead). */
export function macroFieldsBlank(input: MacroFieldInput, trackCalories: boolean): boolean {
  const base = [input.protein, input.fat, input.carbs, input.fiber];
  if (trackCalories) base.push(input.calories);
  return base.every((s) => s.trim() === '');
}

/**
 * User-typed macros. Blank fields are not an estimate — the caller decides
 * that. A partial fill is an error string so the meal is not saved with a
 * half-edited row. Calories are required only when tracking is on.
 */
export function parseUserMacros(
  input: MacroFieldInput,
  trackCalories: boolean,
): { ok: true; macros: MacroGrams } | { ok: false; message: string } {
  const read = (raw: string, label: string): number | string => {
    const t = raw.trim();
    if (t === '') return `${label} is required when you edit macros.`;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return `${label} must be a number 0 or higher.`;
    return n;
  };
  const protein = read(input.protein, 'Protein');
  const fat = read(input.fat, 'Fat');
  const carbs = read(input.carbs, 'Total carbs');
  const fiber = read(input.fiber, 'Fiber');
  if (typeof protein === 'string') return { ok: false, message: protein };
  if (typeof fat === 'string') return { ok: false, message: fat };
  if (typeof carbs === 'string') return { ok: false, message: carbs };
  if (typeof fiber === 'string') return { ok: false, message: fiber };
  let calories: number | null = null;
  if (trackCalories) {
    const cal = read(input.calories, 'Calories');
    if (typeof cal === 'string') return { ok: false, message: cal };
    calories = cal;
  } else if (input.calories.trim() !== '') {
    const cal = read(input.calories, 'Calories');
    if (typeof cal === 'string') return { ok: false, message: cal };
    calories = cal;
  }
  const macros = finalizeMacros(protein, fat, carbs, fiber, calories);
  if (!macros) return { ok: false, message: 'Those macro numbers are outside a plausible range.' };
  return { ok: true, macros };
}

/** One-line summary for a log row. Calories appear only when tracking is on. */
export function formatMacroSummary(
  proteinG: number | null,
  fatG: number | null,
  netCarbsG: number | null,
  calories: number | null,
  source: string,
  trackCalories: boolean,
): string {
  if (proteinG == null || fatG == null || netCarbsG == null) return '';
  const parts = [`P ${proteinG}g`, `F ${fatG}g`, `net C ${netCarbsG}g`];
  if (trackCalories && calories != null) parts.push(`${calories} kcal`);
  const tag = source === 'estimated' ? ' (est.)' : source === 'edited' ? ' (edited)' : '';
  return parts.join(' · ') + tag;
}

export const MACRO_JSON_SCHEMA = {
  type: 'object',
  properties: {
    protein_g: { type: 'number' },
    fat_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fiber_g: { type: 'number' },
    calories: { type: 'number' },
  },
  required: ['protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'calories'],
} as const;

/**
 * A tiny model often emits ~1g placeholders for a real plate of food.
 * Reject those so they are not stored as an estimate.
 */
export function plausibleMacroEstimate(macros: MacroGrams, meal: string): boolean {
  const biggest = Math.max(macros.proteinG, macros.fatG, macros.carbsG);
  const words = meal.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 4 && biggest < 5) return false;
  return biggest > 0;
}

export function macroEstimatePrompt(name: string, notes: string): { system: string; user: string } {
  const meal = notes.trim() ? `${name.trim()} (${notes.trim()})` : name.trim();
  return {
    system:
      'You estimate nutrition for one meal. Reply with JSON only: protein_g, fat_g, carbs_g (total carbohydrates), fiber_g, and calories. Use grams and kilocalories for a typical single serving when the portion is unclear. Do not give advice.',
    user: `Meal: ${meal}`,
  };
}
