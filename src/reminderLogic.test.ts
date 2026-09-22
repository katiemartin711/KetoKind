// Reminder scheduling logic tests: pure functions in src/reminderLogic.ts.
// Run with: npm test

import {
  DEFAULT_REMINDER_SETTINGS,
  computeOccurrences,
  formatTime,
  parseReminderSettings,
  type ReminderSettings,
} from './reminderLogic';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`);
  }
}

function eq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`expected truthy: ${label}`);
}

// Fixed "now": Monday 2026-09-21 19:00 local.
const NOW = new Date(2026, 8, 21, 19, 0, 0, 0);

function settings(over: Partial<ReminderSettings> = {}): ReminderSettings {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    time: { ...DEFAULT_REMINDER_SETTINGS.time },
    custom: [],
    ...over,
  };
}

function dayOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

check('formatTime renders 12-hour clock', () => {
  eq(formatTime({ hour: 20, minute: 0 }), '8:00 PM', '8pm');
  eq(formatTime({ hour: 0, minute: 5 }), '12:05 AM', 'midnight');
  eq(formatTime({ hour: 12, minute: 0 }), '12:00 PM', 'noon');
  eq(formatTime({ hour: 7, minute: 30 }), '7:30 AM', 'morning');
});

check('parseReminderSettings returns defaults for empty input', () => {
  eq(parseReminderSettings(''), DEFAULT_REMINDER_SETTINGS, 'empty string');
  eq(parseReminderSettings(null), DEFAULT_REMINDER_SETTINGS, 'null');
  eq(parseReminderSettings(undefined), DEFAULT_REMINDER_SETTINGS, 'undefined');
});

check('parseReminderSettings tolerates garbage', () => {
  eq(parseReminderSettings('not json'), DEFAULT_REMINDER_SETTINGS, 'bad json');
  eq(parseReminderSettings('42'), DEFAULT_REMINDER_SETTINGS, 'json number');
  const s = parseReminderSettings('{"time":{"hour":99,"minute":-1}}');
  eq(s.time, { hour: 20, minute: 0 }, 'invalid time falls back');
});

check('parseReminderSettings merges partial settings over defaults', () => {
  const s = parseReminderSettings('{"enabled":false,"time":{"hour":7,"minute":30},"onlyIfNoLogs":false}');
  eq(s.enabled, false, 'enabled kept');
  eq(s.time, { hour: 7, minute: 30 }, 'time kept');
  eq(s.onlyIfNoLogs, false, 'onlyIfNoLogs kept');
  eq(s.sound, true, 'sound defaults');
  eq(s.custom, [], 'custom defaults');
});

check('parseReminderSettings keeps valid custom reminders, drops bad ones', () => {
  const s = parseReminderSettings(
    '{"custom":[{"id":"a","hour":7,"minute":0},{"id":"b","hour":25,"minute":0},{"noid":true}]}',
  );
  eq(s.custom, [{ id: 'a', hour: 7, minute: 0 }], 'only valid custom kept');
});

check('main reminder scheduled today when time is still ahead and no logs', () => {
  const occ = computeOccurrences(settings(), NOW, false);
  eq(occ.length, 7, '7 daily occurrences');
  eq(occ[0].kind, 'main', 'first is main');
  eq(dayOf(occ[0].date), '2026-9-21 20:00', 'today at 8pm');
  eq(dayOf(occ[6].date), '2026-9-27 20:00', 'last day');
});

check('main reminder skipped today when logs exist and onlyIfNoLogs', () => {
  const occ = computeOccurrences(settings(), NOW, true);
  eq(occ.length, 6, 'today skipped');
  eq(dayOf(occ[0].date), '2026-9-22 20:00', 'starts tomorrow');
});

check('main reminder fires today even with logs when onlyIfNoLogs is off', () => {
  const occ = computeOccurrences(settings({ onlyIfNoLogs: false }), NOW, true);
  eq(occ.length, 7, 'today included');
  eq(dayOf(occ[0].date), '2026-9-21 20:00', 'today at 8pm');
});

check('main reminder skipped today when its time already passed', () => {
  const late = new Date(2026, 8, 21, 21, 30, 0, 0);
  const occ = computeOccurrences(settings(), late, false);
  eq(occ.length, 6, 'today skipped');
  eq(dayOf(occ[0].date), '2026-9-22 20:00', 'starts tomorrow');
});

check('custom reminders ignore the log check but skip past times today', () => {
  const s = settings({ custom: [{ id: 'c1', hour: 7, minute: 0 }] });
  const occ = computeOccurrences(s, NOW, true);
  // 6 main (today skipped: logs exist) + 6 custom (7am today already passed)
  eq(occ.length, 12, '6 main + 6 custom');
  ok(occ.every((o) => !(o.kind === 'custom' && dayOf(o.date) === '2026-9-21 7:00')), 'no past custom today');
  ok(occ.some((o) => o.kind === 'custom' && o.customId === 'c1' && dayOf(o.date) === '2026-9-22 7:00'), 'custom tomorrow');
});

check('custom reminder later today is included', () => {
  const s = settings({ custom: [{ id: 'c2', hour: 21, minute: 15 }] });
  const occ = computeOccurrences(s, NOW, false);
  ok(occ.some((o) => o.kind === 'custom' && dayOf(o.date) === '2026-9-21 21:15'), 'custom later today');
});

check('occurrences are sorted chronologically', () => {
  const s = settings({ custom: [{ id: 'c3', hour: 6, minute: 30 }] });
  const occ = computeOccurrences(s, NOW, false);
  for (let i = 1; i < occ.length; i++) {
    ok(occ[i].date.getTime() >= occ[i - 1].date.getTime(), 'sorted');
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
