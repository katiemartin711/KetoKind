// Meals the user saved as favorites. Matched by name so saving the same
// meal again updates one row instead of creating a duplicate.

import { database } from './client';
import type { MacroGrams, MacroSource } from '../macros';
import type { FoodLog, MealFavorite } from '../types';

export function listMealFavorites(): MealFavorite[] {
  return database().getAllSync<MealFavorite>(
    'SELECT * FROM meal_favorites ORDER BY name COLLATE NOCASE, id',
  );
}

export function findMealFavorite(name: string): MealFavorite | null {
  return database().getFirstSync<MealFavorite>(
    'SELECT * FROM meal_favorites WHERE lower(trim(name)) = lower(trim(?))',
    [name],
  );
}

export function deleteMealFavorite(id: number): void {
  database().runSync('DELETE FROM meal_favorites WHERE id = ?', [id]);
}

export function deleteMealFavoriteByName(name: string): void {
  database().runSync('DELETE FROM meal_favorites WHERE lower(trim(name)) = lower(trim(?))', [name]);
}

/** Insert or update the favorite for this meal name. */
export function saveMealFavorite(input: {
  name: string;
  mealType: string;
  notes: string;
  macros: MacroGrams | null;
  source: MacroSource | '';
}): void {
  const name = input.name.trim();
  if (!name) return;
  const macros = input.macros;
  const existing = findMealFavorite(name);
  const values = [
    name,
    input.mealType,
    input.notes.trim(),
    macros?.proteinG ?? null,
    macros?.fatG ?? null,
    macros?.carbsG ?? null,
    macros?.fiberG ?? null,
    macros?.netCarbsG ?? null,
    macros?.calories ?? null,
    input.source,
  ];
  if (existing) {
    database().runSync(
      `UPDATE meal_favorites
       SET name = ?, meal_type = ?, notes = ?, protein_g = ?, fat_g = ?, carbs_g = ?,
           fiber_g = ?, net_carbs_g = ?, calories = ?, macro_source = ?
       WHERE id = ?`,
      [...values, existing.id],
    );
    return;
  }
  database().runSync(
    `INSERT INTO meal_favorites
       (name, meal_type, notes, protein_g, fat_g, carbs_g, fiber_g, net_carbs_g, calories, macro_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values,
  );
}

/** Copy a saved meal, including macros, onto its favorite row. */
export function saveMealFavoriteFromLog(row: FoodLog): void {
  const source = row.macro_source === 'estimated' || row.macro_source === 'edited' ? row.macro_source : '';
  const hasMacros = row.protein_g != null && row.fat_g != null && row.carbs_g != null;
  saveMealFavorite({
    name: row.name,
    mealType: row.meal_type,
    notes: row.notes,
    macros: hasMacros
      ? {
          proteinG: row.protein_g ?? 0,
          fatG: row.fat_g ?? 0,
          carbsG: row.carbs_g ?? 0,
          fiberG: row.fiber_g ?? 0,
          netCarbsG: row.net_carbs_g ?? 0,
          calories: row.calories,
        }
      : null,
    source,
  });
}
