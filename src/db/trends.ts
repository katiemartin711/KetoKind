// Trends queries: weight series, per-day symptom severity, and per-day
// med/supplement taken-sets.
//
// The Trends tab is Pro-gated — TrendsScreen only calls these when
// getProStatus() is true (it returns before any query for free users), so a
// free user's data is never loaded for this tab. Keep it that way: do not
// call these from anywhere that isn't behind the Pro check.
//
// Queries are bounded to a recent window (default 180 days) so long histories
// don't load every row into JS on tab focus.

import { database } from './client';
import { localDayKey } from '../trendsStats';
import type { SymptomDay, WeightPoint } from '../trendsStats';

/** Default lookback for Trends queries (days). */
export const TRENDS_LOOKBACK_DAYS = 180;

/** ISO lower bound for "logs since N days ago". */
function sinceIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** Weight entries oldest-first, for the trend graph. */
export function getWeightSeries(lookbackDays: number = TRENDS_LOOKBACK_DAYS): WeightPoint[] {
  const since = sinceIso(lookbackDays);
  const rows = database().getAllSync<{ weight: number; logged_at: string }>(
    'SELECT weight, logged_at FROM weight_logs WHERE logged_at >= ? ORDER BY logged_at ASC',
    [since],
  );
  return rows.map((r) => ({
    day: localDayKey(r.logged_at),
    weight: r.weight,
    at: new Date(r.logged_at).getTime(),
  }));
}

/** Normalize an item name for grouping: log snapshots may differ in case. */
function normName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Every symptom's per-day average severity (a symptom logged twice in one
 * day counts once, averaged), keyed by symptom name. Days oldest-first.
 */
export function getSymptomDayMap(lookbackDays: number = TRENDS_LOOKBACK_DAYS): Map<string, SymptomDay[]> {
  const since = sinceIso(lookbackDays);
  const rows = database().getAllSync<{ name: string; logged_at: string; severity: number }>(
    'SELECT name, logged_at, severity FROM symptom_logs WHERE logged_at >= ? ORDER BY logged_at ASC',
    [since],
  );
  const byNameDay = new Map<string, Map<string, number[]>>();
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const day = localDayKey(r.logged_at);
    let byDay = byNameDay.get(name);
    if (!byDay) {
      byDay = new Map();
      byNameDay.set(name, byDay);
    }
    const arr = byDay.get(day);
    if (arr) arr.push(r.severity);
    else byDay.set(day, [r.severity]);
  }
  const out = new Map<string, SymptomDay[]>();
  for (const [name, byDay] of byNameDay) {
    out.set(
      name,
      [...byDay.entries()]
        .map(([day, sevs]) => ({
          day,
          severity: sevs.reduce((a, b) => a + b, 0) / sevs.length,
        }))
        .sort((a, b) => (a.day < b.day ? -1 : 1)),
    );
  }
  return out;
}

/**
 * Meal text per local day (food name + notes combined), for food × symptom
 * pattern matching. The Trends tab is Pro-gated — only call this behind
 * the Pro check, like the other helpers in this module.
 */
export function getMealDayMap(lookbackDays: number = TRENDS_LOOKBACK_DAYS): Map<string, string[]> {
  const since = sinceIso(lookbackDays);
  const rows = database().getAllSync<{ name: string; notes: string; logged_at: string }>(
    'SELECT name, notes, logged_at FROM food_logs WHERE logged_at >= ? ORDER BY logged_at ASC',
    [since],
  );
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    const text = [r.name?.trim(), r.notes?.trim()].filter(Boolean).join(' — ');
    if (!text) continue;
    const day = localDayKey(r.logged_at);
    const arr = byDay.get(day);
    if (arr) arr.push(text);
    else byDay.set(day, [text]);
  }
  return byDay;
}
export interface ItemDays {
  kind: 'medication' | 'supplement';
  /** Display name (first-seen casing); grouping is case-insensitive. */
  name: string;
  /** Local days on which the item was logged (snapshot names survive renames). */
  days: Set<string>;
}

/**
 * Local days each med/supplement was taken, grouped by snapshot name
 * (case-insensitive). Legacy rows with an empty name snapshot are skipped.
 */
export function getItemDayList(lookbackDays: number = TRENDS_LOOKBACK_DAYS): ItemDays[] {
  const since = sinceIso(lookbackDays);
  const meds = database().getAllSync<{ name: string; taken_at: string }>(
    'SELECT name, taken_at FROM med_logs WHERE taken_at >= ?',
    [since],
  );
  const supps = database().getAllSync<{ name: string; logged_at: string }>(
    'SELECT name, logged_at FROM supplement_logs WHERE logged_at >= ?',
    [since],
  );
  const byKey = new Map<string, ItemDays>();
  const add = (kind: 'medication' | 'supplement', name: string, iso: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = `${kind}:${normName(trimmed)}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { kind, name: trimmed, days: new Set() };
      byKey.set(key, entry);
    }
    entry.days.add(localDayKey(iso));
  };
  for (const r of meds) add('medication', r.name, r.taken_at);
  for (const r of supps) add('supplement', r.name, r.logged_at);
  return [...byKey.values()].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
  );
}
