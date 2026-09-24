// Meal estimate and Trends narrative. Both stay on device.

import { setFoodMacros } from '../db/logs';
import { acceptNarrative, narrativePrompt, type MacroComparison } from '../macroCorrelations';
import { MACRO_JSON_SCHEMA, macroEstimatePrompt, parseMacroJson } from '../macros';
import { completeOnDevice } from './engine';

/** Fill macros for a meal that was already saved. Returns false if the model output was unusable. */
export async function estimateSavedMeal(id: number, name: string, notes: string): Promise<boolean> {
  const prompt = macroEstimatePrompt(name, notes);
  const text = await completeOnDevice(prompt.system, prompt.user, MACRO_JSON_SCHEMA, 180);
  const macros = parseMacroJson(text);
  if (!macros) return false;
  setFoodMacros(id, macros, 'estimated');
  return true;
}

export async function writeTrendNarrative(comparisons: MacroComparison[]): Promise<string | null> {
  if (comparisons.length === 0) return null;
  const prompt = narrativePrompt(comparisons);
  const text = await completeOnDevice(prompt.system, prompt.user, null, 280);
  return acceptNarrative(text);
}
