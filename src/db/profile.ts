// The single profile row (id = 1): diet type, bio, prefs, theme, milestones.
import { database } from './client';
import type { DietType, Profile } from '../types';
import type { ThemeMode } from '../theme';
import { parseReminderSettings, type ReminderSettings } from '../reminderLogic';

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
        dismissed_milestones = '',
        is_pro = 0,
        reminder_settings = '',
        track_calories = 0,
        llm_offer = ''
      WHERE id = 1;
      DELETE FROM trend_insights;
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

/** KetoKind Pro unlock: AI Coach context export + backup export/import. */
export function getProStatus(): boolean {
  const row = database().getFirstSync<{ is_pro: number }>('SELECT is_pro FROM profile WHERE id = 1');
  return (row?.is_pro ?? 0) === 1;
}

export function setProStatus(pro: boolean): void {
  database().runSync('UPDATE profile SET is_pro = ? WHERE id = 1', [pro ? 1 : 0]);
}

/** Calories stay hidden (and out of Trends correlations) until this is on. */
export function getTrackCalories(): boolean {
  const row = database().getFirstSync<{ track_calories: number }>(
    'SELECT track_calories FROM profile WHERE id = 1',
  );
  return (row?.track_calories ?? 0) === 1;
}

export function setTrackCalories(on: boolean): void {
  database().runSync('UPDATE profile SET track_calories = ? WHERE id = 1', [on ? 1 : 0]);
}

/** '' until the user answers the download prompt; 'declined' skips future prompts. */
export function getLlmOffer(): '' | 'declined' {
  const row = database().getFirstSync<{ llm_offer: string }>('SELECT llm_offer FROM profile WHERE id = 1');
  return row?.llm_offer === 'declined' ? 'declined' : '';
}

export function setLlmOffer(offer: '' | 'declined'): void {
  database().runSync('UPDATE profile SET llm_offer = ? WHERE id = 1', [offer]);
}

/** True once reminder settings were explicitly written (defaults or custom).
 *  Distinguishes "never configured" from "configured to the defaults". */
export function hasReminderSettings(): boolean {
  const row = database().getFirstSync<{ reminder_settings: string }>(
    'SELECT reminder_settings FROM profile WHERE id = 1',
  );
  return !!row?.reminder_settings;
}

/** Reminder preferences (daily nudge time, extra reminders, sound/badge).
 *  Stored as JSON; '' means "never configured" and parses to the defaults. */
export function getReminderSettings(): ReminderSettings {
  const row = database().getFirstSync<{ reminder_settings: string }>(
    'SELECT reminder_settings FROM profile WHERE id = 1',
  );
  return parseReminderSettings(row?.reminder_settings);
}

export function saveReminderSettings(s: ReminderSettings): void {
  database().runSync('UPDATE profile SET reminder_settings = ? WHERE id = 1', [JSON.stringify(s)]);
}
