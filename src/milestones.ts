// Diet-start date + milestone logic.
//
// diet_start is stored as 'YYYY-MM' (month known) or 'YYYY-MM-DD' (exact day
// known). Everything here is computed in local time.

export interface DietStart {
  year: number;
  month: number; // 1-12
  day: number | null; // null = only month/year known
}

/** Parse 'YYYY-MM' or 'YYYY-MM-DD' — null when blank or invalid. */
export function parseDietStart(s: string | null | undefined): DietStart | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = m[3] ? parseInt(m[3], 10) : null;
  if (month < 1 || month > 12) return null;
  if (day != null) {
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;
  }
  return { year, month, day };
}

/** Build the stored string from validated parts. */
export function toDietStartString(year: number, month: number, day: number | null): string {
  const mm = String(month).padStart(2, '0');
  return day != null ? `${year}-${mm}-${String(day).padStart(2, '0')}` : `${year}-${mm}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'March 2024' or 'March 4, 2024'. */
export function formatDietStart(s: string | null | undefined): string {
  const p = parseDietStart(s);
  if (!p) return 'Not specified';
  return p.day != null
    ? `${MONTH_NAMES[p.month - 1]} ${p.day}, ${p.year}`
    : `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

/** Local start-of-day for the diet (first of the month when day unknown). */
function startOfDay(s: string | null | undefined): Date | null {
  const p = parseDietStart(s);
  if (!p) return null;
  return new Date(p.year, p.month - 1, p.day ?? 1, 0, 0, 0, 0);
}

/** Whole days from diet start to today (local). Null when unset. */
export function daysSinceDietStart(s: string | null | undefined): number | null {
  const start = startOfDay(s);
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - start.getTime()) / 86400000);
}

/** Human duration like '6 days', '3 months', '2 years 6 months' — for context. */
export function dietDurationLabel(s: string | null | undefined): string | null {
  const days = daysSinceDietStart(s);
  if (days == null || days < 0) return null;
  if (days === 0) return 'started today';
  if (days < 30) return days === 1 ? '1 day' : `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;
  const years = Math.floor(months / 12);
  const rem = Math.round(months % 12);
  const y = years === 1 ? '1 year' : `${years} years`;
  return rem > 0 ? `${y} ${rem === 1 ? '1 month' : `${rem} months`}` : y;
}

export interface Milestone {
  key: string; // stable id, e.g. 'd30' / 'y1' — used for dismissal
  days: number; // days-since-start the milestone lands on
  label: string; // '30 days', '6 months', '1 year', ...
}

const EARLY_MILESTONES: Milestone[] = [
  { key: 'd7', days: 7, label: '1 week' },
  { key: 'd30', days: 30, label: '30 days' },
  { key: 'd90', days: 90, label: '90 days' },
  { key: 'd180', days: 180, label: '6 months' },
];

/**
 * The milestone being celebrated right now, if any. Each milestone shows for
 * 7 days after it lands so it isn't missed when the app isn't opened that day.
 * Dismissed milestones never come back.
 */
export function currentMilestone(
  dietStart: string | null | undefined,
  dismissed: string[],
): Milestone | null {
  const days = daysSinceDietStart(dietStart);
  if (days == null || days < 0) return null;
  const all: Milestone[] = [...EARLY_MILESTONES];
  for (let y = 1; y * 365 <= days + 6; y++) {
    all.push({ key: `y${y}`, days: y * 365, label: y === 1 ? '1 year' : `${y} years` });
  }
  const hit = all
    .filter((m) => days >= m.days && days < m.days + 7 && !dismissed.includes(m.key))
    .sort((a, b) => b.days - a.days)[0];
  return hit ?? null;
}
