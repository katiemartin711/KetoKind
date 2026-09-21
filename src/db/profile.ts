// The single profile row (id = 1): diet type, bio, prefs, theme, milestones.
import { database } from './client';
import type { DietType, Profile } from '../types';
import type { ThemeMode } from '../theme';

export function getProfile(): Profile {
  const row = database().getFirstSync<Profile>('SELECT * FROM profile WHERE id = 1');
  if (!row) throw new Error('Profile row missing — did initDb() run?');
  return row;
}

export function saveProfile(
  dietType: DietType,
  nuances: string,
  goals: string,
  age: number | null,
  sex: string,
  bio: string,
  dietStart: string | null,
  name: string,
): void {
  database().runSync(
    'UPDATE profile SET diet_type = ?, diet_nuances = ?, goals = ?, age = ?, sex = ?, bio = ?, diet_start = ?, name = ? WHERE id = 1',
    [dietType, nuances.trim(), goals.trim(), age, sex, bio, dietStart, name.trim()],
  );
}

/** Milestone keys (e.g. 'd30', 'y1') the user already dismissed. */
export function getDismissedMilestones(): string[] {
  const row = database().getFirstSync<{ dismissed_milestones: string }>(
    'SELECT dismissed_milestones FROM profile WHERE id = 1',
  );
  const raw = row?.dismissed_milestones ?? '';
  return raw ? raw.split(',').filter(Boolean) : [];
}

/** Wipe everything on device: all logs, lists, and profile fields back to
 *  defaults — including the appearance theme, so a fresh start is truly fresh.
 *  The DELETEs + profile reset run in one transaction (a failure mid-batch
 *  can't leave a half-wiped database); VACUUM stays outside because SQLite
 *  forbids it inside a transaction. */
export function deleteAllData(): void {
  database().withTransactionSync(() => {
    database().execSync(`
      DELETE FROM allergies;
      DELETE FROM conditions;
      DELETE FROM medications;
      DELETE FROM supplements;
      DELETE FROM food_logs;
      DELETE FROM med_logs;
      DELETE FROM symptom_logs;
      DELETE FROM supplement_logs;
      DELETE FROM weight_logs;
      UPDATE profile SET
        name = '',
        diet_type = 'carnivore',
        diet_nuances = '',
        goals = '',
        theme_mode = 'system',
        track_weight = 0,
        starting_weight = NULL,
        age = NULL,
        sex = '',
        bio = '',
        diet_start = NULL,
        dismissed_milestones = ''
      WHERE id = 1;
    `);
    // Reset id counters (separate statement: sqlite_sequence is a system
    // table, but deleting from it inside the transaction is fine).
    database().execSync('DELETE FROM sqlite_sequence;');
  });
  // Actually purge the deleted rows from the file (DELETE alone leaves them
  // in free pages).
  database().execSync('VACUUM;');
}


/** True once the user has filled in anything meaningful on the Profile tab
 *  (name, age, sex, bio, goals, nuances, or diet start date). Used to nudge
 *  brand-new users toward setup on the Dashboard. */
export function isProfileSetup(p: Profile): boolean {
  return (
    p.name.trim() !== '' ||
    p.age != null ||
    p.sex !== '' ||
    p.bio.trim() !== '' ||
    p.goals.trim() !== '' ||
    p.diet_nuances.trim() !== '' ||
    p.diet_start != null
  );
}

/** Remember that the user dismissed milestone banners so they stay gone.
 *  Pass every reached milestone's key — dismissing the newest banner also
 *  clears older ones so they never pop back up. */
export function dismissMilestones(keys: string[]): void {
  const current = getDismissedMilestones();
  const merged = [...current];
  for (const k of keys) {
    if (!merged.includes(k)) merged.push(k);
  }
  database().runSync('UPDATE profile SET dismissed_milestones = ? WHERE id = 1', [merged.join(',')]);
}

/** Persist just the diet type — auto-saved the moment the user taps an option. */
export function persistDietType(dietType: DietType): void {
  database().runSync('UPDATE profile SET diet_type = ? WHERE id = 1', [dietType]);
}

/** Weight-tracking preference + starting weight (lbs, null when unset). */
export function setWeightTracking(trackWeight: boolean, startingWeight: number | null): void {
  database().runSync('UPDATE profile SET track_weight = ?, starting_weight = ? WHERE id = 1', [
    trackWeight ? 1 : 0,
    startingWeight,
  ]);
}

/** 'system' (default) follows the phone's light/dark setting. */
export function getThemeMode(): ThemeMode {
  const row = database().getFirstSync<{ theme_mode: string }>('SELECT theme_mode FROM profile WHERE id = 1');
  const m = row?.theme_mode;
  return m === 'light' || m === 'dark' ? m : 'system';
}

export function setThemeMode(mode: ThemeMode): void {
  database().runSync('UPDATE profile SET theme_mode = ? WHERE id = 1', [mode]);
}
