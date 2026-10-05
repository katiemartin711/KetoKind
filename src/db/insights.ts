// Day-level macro totals and the cached Trends narrative.
import { database } from './client';
import { localDayKey, sinceIsoForRange } from '../trendsStats';
import type { MacroDay } from '../macroCorrelations';

interface MacroRow {
  logged_at: string;
  protein_g: number;
  fat_g: number;
  net_carbs_g: number;
  calories: number | null;
}

/**
 * Sum estimated or edited meals onto local days. Days with no macros are omitted.
 * `lookbackDays` null has no date bound. A number keeps meals at or after
 * sinceIsoForRange (same local start-of-day cutoff as the other Trends queries).
 */
export function listDailyMacros(lookbackDays: number | null = null): Map<string, MacroDay> {
  const since = sinceIsoForRange(lookbackDays);
  const sql = since
    ? `SELECT logged_at, protein_g, fat_g, net_carbs_g, calories
       FROM food_logs
       WHERE macro_source IN ('estimated', 'edited')
         AND protein_g IS NOT NULL
         AND fat_g IS NOT NULL
         AND net_carbs_g IS NOT NULL
         AND logged_at >= ?`
    : `SELECT logged_at, protein_g, fat_g, net_carbs_g, calories
       FROM food_logs
       WHERE macro_source IN ('estimated', 'edited')
         AND protein_g IS NOT NULL
         AND fat_g IS NOT NULL
         AND net_carbs_g IS NOT NULL`;
  const rows = since
    ? database().getAllSync<MacroRow>(sql, [since])
    : database().getAllSync<MacroRow>(sql);
  const map = new Map<string, MacroDay>();
  for (const r of rows) {
    const day = localDayKey(r.logged_at);
    const prev = map.get(day);
    if (!prev) {
      map.set(day, {
        day,
        proteinG: r.protein_g,
        fatG: r.fat_g,
        netCarbsG: r.net_carbs_g,
        calories: r.calories,
      });
    } else {
      prev.proteinG += r.protein_g;
      prev.fatG += r.fat_g;
      prev.netCarbsG += r.net_carbs_g;
      if (prev.calories == null || r.calories == null) prev.calories = null;
      else prev.calories += r.calories;
    }
  }
  return map;
}

export function getCachedNarrative(fingerprint: string): string | null {
  const row = database().getFirstSync<{ fingerprint: string; narrative: string }>(
    'SELECT fingerprint, narrative FROM trend_insights WHERE id = 1',
  );
  if (!row || row.fingerprint !== fingerprint || !row.narrative) return null;
  return row.narrative;
}

export function saveNarrative(fingerprint: string, narrative: string): void {
  database().runSync(
    `INSERT INTO trend_insights (id, fingerprint, narrative, generated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET fingerprint = excluded.fingerprint, narrative = excluded.narrative, generated_at = excluded.generated_at`,
    [fingerprint, narrative, new Date().toISOString()],
  );
}
