// Trends statistics — pure functions for the Trends tab.
// No db access, no React: every function takes plain arrays so it is
// trivially unit-testable (see src/trendsStats.test.ts). The screen layer
// (src/screens/TrendsScreen.tsx) loads data via src/db/trends.ts and feeds
// it in here.
//
// Copy discipline (App Store safety): everything here describes *patterns
// in the user's logs* — averages and differences only. Nothing here says an
// item causes, improves, or worsens a symptom, and nothing suggests
// starting, stopping, or changing any medication.

/** Days needed on the baseline side of a taken/not-taken comparison.
 *  Below this the baseline average is noise. */
export const MIN_BASELINE_DAYS = 7;
/** Days needed on the smaller side of a taken/not-taken comparison.
 *  Lets regular takers see a pattern even when they've only missed a few
 *  days (and vice versa for rarely-taken items). */
export const MIN_COMPARISON_DAYS = 2;
/** @deprecated use MIN_BASELINE_DAYS / MIN_COMPARISON_DAYS */
export const MIN_PATTERN_DAYS = 7;

/** 'YYYY-MM-DD' in the device's local timezone for an ISO timestamp. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Short 'M/D' label for a local day key, for chart axes. */
export function shortDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return `${m}/${d}`;
}

/** Mean of values, or null when there are none. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Round to one decimal for display (weights, severities). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** One day's symptom severity (averaged when logged multiple times that day). */
export interface SymptomDay {
  day: string; // local YYYY-MM-DD
  severity: number; // 1-5
}

/** Symptom severities split by whether the item was taken that day. */
export interface DayBuckets {
  taken: number[];
  notTaken: number[];
}

/**
 * Split a symptom's per-day severities into days the item was taken vs. days
 * it wasn't. The universe is days the symptom was logged — days with no
 * symptom entry say nothing about that symptom.
 */
export function bucketDays(symptomDays: SymptomDay[], itemDays: Set<string>): DayBuckets {
  const taken: number[] = [];
  const notTaken: number[] = [];
  for (const s of symptomDays) {
    if (itemDays.has(s.day)) taken.push(s.severity);
    else notTaken.push(s.severity);
  }
  return { taken, notTaken };
}

export interface PatternComparison {
  symptomName: string;
  itemName: string;
  itemKind: 'medication' | 'supplement';
  avgTaken: number;
  avgNotTaken: number;
  /** avgTaken - avgNotTaken. Negative = lower average severity on days taken. */
  diff: number;
  daysTaken: number;
  daysNotTaken: number;
}

/**
 * Compare average symptom severity on days an item was taken vs. days it
 * wasn't. Returns null when the data is too thin: at least
 * MIN_COMPARISON_DAYS on each side and MIN_BASELINE_DAYS on at least one
 * side — the comparison is withheld rather than shown on thin data.
 * This lets very regular takers see a pattern from just a few missed days.
 */
export function comparePattern(
  symptomName: string,
  symptomDays: SymptomDay[],
  itemName: string,
  itemKind: 'medication' | 'supplement',
  itemDays: Set<string>,
): PatternComparison | null {
  const { taken, notTaken } = bucketDays(symptomDays, itemDays);
  // Both sides need at least a couple of days, and at least one side needs
  // a solid baseline — so a regular taker with just a few missed days still
  // gets a pattern (and vice versa for rarely-taken items).
  const eachSideEnough =
    taken.length >= MIN_COMPARISON_DAYS && notTaken.length >= MIN_COMPARISON_DAYS;
  const hasBaseline =
    taken.length >= MIN_BASELINE_DAYS || notTaken.length >= MIN_BASELINE_DAYS;
  if (!eachSideEnough || !hasBaseline) return null;
  const avgTaken = average(taken) as number;
  const avgNotTaken = average(notTaken) as number;
  return {
    symptomName,
    itemName,
    itemKind,
    avgTaken,
    avgNotTaken,
    diff: avgTaken - avgNotTaken,
    daysTaken: taken.length,
    daysNotTaken: notTaken.length,
  };
}

export interface RankedPattern extends PatternComparison {
  absDiff: number;
}

/**
 * Strongest patterns across candidate pairs: only pairs meeting the day
 * threshold qualify, ranked by absolute severity difference, top `limit`.
 */
export function rankPatterns(
  comparisons: (PatternComparison | null)[],
  limit: number = 3,
): RankedPattern[] {
  return comparisons
    .filter((c): c is PatternComparison => c !== null)
    .map((c) => ({ ...c, absDiff: Math.abs(c.diff) }))
    .sort((a, b) => b.absDiff - a.absDiff)
    .slice(0, limit);
}

export interface WeightPoint {
  day: string; // local YYYY-MM-DD
  weight: number; // lbs
  at: number; // ms epoch of the log, for sorting/filtering
}

/**
 * Keep only points within the trailing `days` window.
 * Pass days < 0 for "all time".
 */
export function filterWeightRange(points: WeightPoint[], days: number): WeightPoint[] {
  if (days < 0) return points;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return points.filter((p) => p.at >= cutoff);
}

/**
 * Keep only symptom days within the trailing `daysBack` window.
 * Pass daysBack < 0 for all time. Compares local day keys (YYYY-MM-DD),
 * which sort chronologically.
 */
export function filterSymptomRange(days: SymptomDay[], daysBack: number): SymptomDay[] {
  if (daysBack < 0) return days;
  const cutoff = localDayKey(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());
  return days.filter((d) => d.day >= cutoff);
}

export interface WeightSummary {
  current: number;
  min: number;
  max: number;
  /** current minus the first point in the (filtered) range */
  change: number;
}

/** Min/max/current/change for a (possibly range-filtered) weight series. */
export function summarizeWeights(points: WeightPoint[]): WeightSummary | null {
  if (points.length === 0) return null;
  const weights = points.map((p) => p.weight);
  return {
    current: weights[weights.length - 1],
    min: Math.min(...weights),
    max: Math.max(...weights),
    change: weights[weights.length - 1] - weights[0],
  };
}

/** "0.8 lower on days taken" / "1.2 higher on days taken" — describes the
 *  pattern in the logs without implying cause. */
export function diffLabel(diff: number): string {
  const v = round1(Math.abs(diff));
  if (v === 0) return 'about the same on days taken vs. not taken';
  return `${v} ${diff < 0 ? 'lower' : 'higher'} on days taken`;
}
