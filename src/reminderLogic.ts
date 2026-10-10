// Reminder scheduling logic: pure functions with no native or database
// dependencies, so they can be unit-tested under plain Node.
//
// The actual OS scheduling (expo-notifications) lives in src/reminders.ts
// and consumes occurrencesToSchedule() below.

/** A wall-clock time in 24-hour form, interpreted in the phone's local timezone. */
export interface ReminderTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface CustomReminder extends ReminderTime {
  id: string;
}

export interface ReminderSettings {
  enabled: boolean;
  /** The main daily "log your day" reminder. */
  time: ReminderTime;
  /** When true, the main reminder is skipped on days that already have logs. */
  onlyIfNoLogs: boolean;
  sound: boolean;
  badge: boolean;
  /** Extra user-added daily reminders (always fire; they are explicit alarms). */
  custom: CustomReminder[];
}

/** Product default: a single 8pm nudge, only when nothing was logged. */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  time: { hour: 20, minute: 0 },
  onlyIfNoLogs: true,
  sound: true,
  badge: true,
  custom: [],
};

function isValidTime(t: unknown): t is ReminderTime {
  if (typeof t !== 'object' || t === null) return false;
  const { hour, minute } = t as Record<string, unknown>;
  return (
    typeof hour === 'number' &&
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    typeof minute === 'number' &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59
  );
}

/** Parse the JSON stored in profile.reminder_settings, tolerating garbage:
 *  anything missing or malformed falls back to the default. */
export function parseReminderSettings(raw: string | null | undefined): ReminderSettings {
  if (!raw) return { ...DEFAULT_REMINDER_SETTINGS, time: { ...DEFAULT_REMINDER_SETTINGS.time }, custom: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS, time: { ...DEFAULT_REMINDER_SETTINGS.time }, custom: [] };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ...DEFAULT_REMINDER_SETTINGS, time: { ...DEFAULT_REMINDER_SETTINGS.time }, custom: [] };
  }
  const p = parsed as Record<string, unknown>;
  const customRaw = Array.isArray(p.custom) ? p.custom : [];
  const custom: CustomReminder[] = customRaw
    .filter(
      (c): c is CustomReminder =>
        typeof c === 'object' && c !== null && typeof (c as CustomReminder).id === 'string' && isValidTime(c),
    )
    .map((c) => ({ id: c.id, hour: c.hour, minute: c.minute }))
    .slice(0, 12);
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
    time: isValidTime(p.time) ? { hour: p.time.hour, minute: p.time.minute } : { ...DEFAULT_REMINDER_SETTINGS.time },
    onlyIfNoLogs:
      typeof p.onlyIfNoLogs === 'boolean' ? p.onlyIfNoLogs : DEFAULT_REMINDER_SETTINGS.onlyIfNoLogs,
    sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_REMINDER_SETTINGS.sound,
    badge: typeof p.badge === 'boolean' ? p.badge : DEFAULT_REMINDER_SETTINGS.badge,
    custom,
  };
}

/** "8:00 PM", "12:05 AM" — for settings rows and summaries. */
export function formatTime(t: ReminderTime): string {
  const ampm = t.hour < 12 ? 'AM' : 'PM';
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${h12}:${String(t.minute).padStart(2, '0')} ${ampm}`;
}

/** Calendar fields for a one-shot local notification (Expo month is 0–11). */
export interface WallClockSchedule {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface ScheduledOccurrence {
  /** Local date/time the notification should fire. */
  date: Date;
  /** Device-local wall clock passed to OS calendar triggers (not UTC). */
  wallClock: WallClockSchedule;
  kind: 'main' | 'custom';
  customId?: string;
}

/** IANA timezone id for the device (used to reschedule after travel or DST). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function wallClockFrom(base: Date, time: ReminderTime): WallClockSchedule {
  return {
    year: base.getFullYear(),
    month: base.getMonth(),
    day: base.getDate(),
    hour: time.hour,
    minute: time.minute,
  };
}

/**
 * Concrete fire times for the next `daysAhead` days (including today).
 *
 * - Today's main reminder is skipped when its time already passed, or when
 *   `onlyIfNoLogs` is set and the day already has logs.
 * - Future days are always scheduled: whether they end up needed is decided
 *   by reconcile(), which re-runs whenever the app foregrounds or logs change.
 * - Custom reminders are explicit user alarms, so they ignore the log check.
 */
export function computeOccurrences(
  settings: ReminderSettings,
  now: Date,
  hasLogsToday: boolean,
  daysAhead = 7,
): ScheduledOccurrence[] {
  const out: ScheduledOccurrence[] = [];
  for (let day = 0; day < daysAhead; day++) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
    const mainAt = new Date(base);
    mainAt.setHours(settings.time.hour, settings.time.minute, 0, 0);
    const isToday = day === 0;
    const mainInPast = mainAt.getTime() <= now.getTime();
    const mainSkippedByLogs = isToday && settings.onlyIfNoLogs && hasLogsToday;
    if (!(isToday && (mainInPast || mainSkippedByLogs))) {
      out.push({ date: mainAt, wallClock: wallClockFrom(base, settings.time), kind: 'main' });
    }
    for (const c of settings.custom) {
      const at = new Date(base);
      at.setHours(c.hour, c.minute, 0, 0);
      if (isToday && at.getTime() <= now.getTime()) continue;
      out.push({ date: at, wallClock: wallClockFrom(base, c), kind: 'custom', customId: c.id });
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

export function scheduleKey(
  settings: ReminderSettings,
  hasLogsToday: boolean,
  localDate: string,
  timeZone: string = deviceTimeZone(),
): string {
  return JSON.stringify({
    localDate,
    timeZone,
    enabled: settings.enabled,
    time: settings.time,
    onlyIfNoLogs: settings.onlyIfNoLogs,
    hasLogsToday: settings.onlyIfNoLogs ? hasLogsToday : false,
    sound: settings.sound,
    badge: settings.badge,
    custom: settings.custom,
  });
}

export function occurrencesToSchedule(
  settings: ReminderSettings,
  now: Date,
  hasLogsToday: boolean,
  daysAhead = 7,
): ScheduledOccurrence[] {
  return computeOccurrences(settings, now, hasLogsToday, daysAhead).filter(
    (occ) => settings.enabled || occ.kind === 'custom',
  );
}

/** Unique id for a newly added custom reminder. */
export function newCustomReminderId(): string {
  return `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
