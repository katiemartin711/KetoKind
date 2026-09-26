// Symptom severity vs. macro balance. Pure: the screen loads day totals
// and symptom days, then calls these functions.
//
// Copy discipline matches trendsStats: patterns in the logs, never causes,
// and nothing suggests changing food or medication.

import { MIN_BASELINE_DAYS, MIN_COMPARISON_DAYS, average } from './trendsStats';
import type { SymptomDay } from './trendsStats';

export interface MacroDay {
  day: string; // local YYYY-MM-DD
  proteinG: number;
  fatG: number;
  netCarbsG: number;
  calories: number | null;
}

export type MacroAxis = 'protein' | 'fat' | 'netCarbs' | 'calories';

export const MACRO_AXIS_LABEL: Record<MacroAxis, string> = {
  protein: 'protein',
  fat: 'fat',
  netCarbs: 'net carbs',
  calories: 'calories',
};

export interface MacroComparison {
  symptomName: string;
  axis: MacroAxis;
  avgHigh: number;
  avgLow: number;
  /** avgHigh − avgLow. Negative = lower average severity on higher-macro days. */
  diff: number;
  daysHigh: number;
  daysLow: number;
  /** Median of the axis on the days that were compared. */
  split: number;
}

function axisValue(day: MacroDay, axis: MacroAxis): number | null {
  if (axis === 'protein') return day.proteinG;
  if (axis === 'fat') return day.fatG;
  if (axis === 'netCarbs') return day.netCarbsG;
  return day.calories;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}

/**
 * Compare average symptom severity on days above the median of one macro
 * vs. days at or below it. The universe is days the symptom was logged AND
 * that day has a macro total. Thin splits are withheld (same day floors as
 * medication patterns). Returns null when every day has the same value.
 */
export function compareMacroBalance(
  symptomName: string,
  symptomDays: SymptomDay[],
  macroDays: Map<string, MacroDay>,
  axis: MacroAxis,
): MacroComparison | null {
  const paired: { severity: number; value: number }[] = [];
  for (const s of symptomDays) {
    const m = macroDays.get(s.day);
    if (!m) continue;
    const value = axisValue(m, axis);
    if (value == null) continue;
    paired.push({ severity: s.severity, value });
  }
  if (paired.length === 0) return null;
  const split = median(paired.map((p) => p.value));
  const high: number[] = [];
  const low: number[] = [];
  for (const p of paired) {
    if (p.value > split) high.push(p.severity);
    else low.push(p.severity);
  }
  if (high.length < MIN_COMPARISON_DAYS || low.length < MIN_COMPARISON_DAYS) return null;
  if (high.length < MIN_BASELINE_DAYS && low.length < MIN_BASELINE_DAYS) return null;
  const avgHigh = average(high);
  const avgLow = average(low);
  if (avgHigh == null || avgLow == null) return null;
  return {
    symptomName,
    axis,
    avgHigh,
    avgLow,
    diff: avgHigh - avgLow,
    daysHigh: high.length,
    daysLow: low.length,
    split,
  };
}

export function macroAxes(trackCalories: boolean): MacroAxis[] {
  const axes: MacroAxis[] = ['protein', 'fat', 'netCarbs'];
  if (trackCalories) axes.push('calories');
  return axes;
}

/** Stable id for the cached narrative. Changes when any comparison changes. */
export function macroFingerprint(comparisons: MacroComparison[]): string {
  const rows = comparisons.map((c) => ({
    s: c.symptomName,
    a: c.axis,
    h: Math.round(c.avgHigh * 10) / 10,
    l: Math.round(c.avgLow * 10) / 10,
    dh: c.daysHigh,
    dl: c.daysLow,
  }));
  return JSON.stringify(rows);
}

export function narrativePrompt(comparisons: MacroComparison[]): { system: string; user: string } {
  const lines = comparisons.map((c) => {
    const label = MACRO_AXIS_LABEL[c.axis];
    return `${c.symptomName}: higher-${label} days avg severity ${c.avgHigh.toFixed(1)} (${c.daysHigh} days) vs lower-${label} days ${c.avgLow.toFixed(1)} (${c.daysLow} days).`;
  });
  return {
    system:
      'You describe patterns in a diet log. Write 2 to 4 short sentences. Say "in your logs" or "averaged". Never say a food causes, improves, or worsens a symptom. Never tell the reader to start, stop, or change medication or diet. No diagnosis.',
    user: `These comparisons are already calculated. Summarize them:\n${lines.join('\n')}`,
  };
}

const UNSAFE_NARRATIVE = /\b(you should|stop taking|start taking|increase your|decrease your|diagnos)/i;

/** Drop model text that slips into advice. Empty or unsafe text is unusable. */
export function acceptNarrative(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 20 || trimmed.length > 1200) return null;
  if (UNSAFE_NARRATIVE.test(trimmed)) return null;
  return trimmed;
}

export function macroDiffSentence(c: MacroComparison): string {
  const label = MACRO_AXIS_LABEL[c.axis];
  const higher = c.diff > 0.05;
  const lower = c.diff < -0.05;
  const direction = higher
    ? 'higher'
    : lower
      ? 'lower'
      : 'about the same';
  if (direction === 'about the same') {
    return `${c.symptomName} severity averaged about the same on higher-${label} days and lower-${label} days (${c.daysHigh} vs. ${c.daysLow} days).`;
  }
  const hi = c.avgHigh.toFixed(1);
  const lo = c.avgLow.toFixed(1);
  return `On higher-${label} days, ${c.symptomName} severity averaged ${hi} vs. ${lo} on lower-${label} days (${c.daysHigh} vs. ${c.daysLow} days).`;
}
