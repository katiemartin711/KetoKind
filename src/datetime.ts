// Shared local-date / time formatters used across Log, Dashboard, Export,
// and list screens — keeps locale formatting in one place.

/** "3:45 PM" from an ISO timestamp. */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "9/23/2026 3:45 PM" from an ISO timestamp (AI Coach export lines). */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** "Wednesday, September 23" for a Date (Dashboard subtitle). */
export function fmtLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** "Wed, Sep 23, 3:45 PM" for a Date (DateTimeField display). */
export function fmtDateTimeFromDate(date: Date): string {
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** "Today" / "Yesterday" / "Wednesday, September 23" for an ISO timestamp. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameLocalDay(d, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Local-day key for grouping list sections (year-month-date). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
