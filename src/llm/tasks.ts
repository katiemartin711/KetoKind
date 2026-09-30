// Meal estimate and Trends narrative. Both stay on device.

import { setFoodMacros } from '../db/logs';
import { acceptNarrative, narrativePrompt, type MacroComparison } from '../macroCorrelations';
import { MACRO_JSON_SCHEMA, macroEstimatePrompt, parseMacroJson, plausibleMacroEstimate } from '../macros';

export type MealCompleter = (
  system: string,
  user: string,
  schema: object | null,
  nPredict: number,
) => Promise<string>;

async function completeWithOnDeviceModel(
  system: string,
  user: string,
  schema: object | null,
  nPredict: number,
): Promise<string> {
  const { completeOnDevice } = await import('./engine');
  return completeOnDevice(system, user, schema, nPredict);
}

export interface MealEstimateResult {
  /** True when the reply was parsed and written onto the meal. */
  stored: boolean;
  /** Exact model text, or the error message if the model call threw. */
  raw: string;
}

/** Fill macros for a meal that was already saved. Unusable output is returned and not stored. */
export async function estimateSavedMeal(
  id: number,
  name: string,
  notes: string,
  complete: MealCompleter = completeWithOnDeviceModel,
): Promise<MealEstimateResult> {
  const prompt = macroEstimatePrompt(name, notes);
  let text = '';
  try {
    text = await complete(prompt.system, prompt.user, MACRO_JSON_SCHEMA, 180);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { stored: false, raw: message };
  }
  const macros = parseMacroJson(text);
  const meal = [name.trim(), notes.trim()].filter(Boolean).join('\n');
  if (!macros || !plausibleMacroEstimate(macros, meal)) return { stored: false, raw: text };
  setFoodMacros(id, macros, 'estimated');
  return { stored: true, raw: text };
}

export async function writeTrendNarrative(comparisons: MacroComparison[]): Promise<string | null> {
  if (comparisons.length === 0) return null;
  const prompt = narrativePrompt(comparisons);
  const text = await completeWithOnDeviceModel(prompt.system, prompt.user, null, 280);
  return acceptNarrative(text);
}
