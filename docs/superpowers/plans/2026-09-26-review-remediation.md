# KetoKind Review Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the verified bugs from the 2026-09-26 senior review so a normal medication delete can still be backed up, Trends ranges match their labels, reminders stay honest, the coach export matches the logs it claims to contain, and the on-device model cannot unlock Pro or accept advice-shaped text.

**Reviewed at:** `905cc53` (`On-device meal macros and Trends insights`). Schema version is 8. The orphan-backup, 180-day Trends cap, reminder schedule key, and truncated coach export are still present on that commit. `purchaseTestModeEnabled` already exists and is tested to treat a missing `__DEV__` as test mode.

**Architecture:** Keep the local-first SQLite boundary. Pure functions (`reminderLogic`, `trendsStats`, `foodGroups`, `milestones`, `dietPrinciples`, `backup` validation) stay the test surface. Screens only pass the right arguments and clear stale Pro state. Do not add a network client, analytics, or a real StoreKit integration in this plan.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-sqlite synchronous API, TypeScript, `npm test` (`tsc -p tsconfig.test.json` then `node dist-test/*.test.js` via `test/run.js`). Tests use the in-repo `check` / `eq` / `ok` helpers, not Jest.

## Global Constraints

- Read https://docs.expo.dev/versions/v57.0.0/ before changing Expo APIs. Do not invent file-system or notification calls.
- Health data stays on device. No `fetch`, analytics, or push tokens.
- `is_pro` never travels in a backup and import must keep this device's flag.
- Trends and AI Coach copy stays descriptive. Never say a food, medication, or supplement causes, improves, or worsens anything, and never suggest starting, stopping, or changing a medication.
- Free users do not run Trends queries or `getExportData()`.
- `npm test` and `npx tsc --noEmit` must pass at the end of every task.
- Do not wire real StoreKit in this plan. Release builds must keep failing closed.

## Review verdict

**Not ready to ship.** Parameterized SQL, backup transactions, Pro preservation, pattern thresholds, and the privacy "no network" claim are solid. Two behaviors break the product promise: deleting a medication or supplement makes this app's own backup unrestorable, and the "only if you haven't logged" reminder fires on days the user already logged whenever the process stays alive. Trends then labels a 180-day query as Year and All.

Work the tasks in order. Each one is independently testable. Phases can ship as separate commits on one branch.

---

### Task 1: Orphan dose history must round-trip through backup

**Files:**
- Modify: `src/db/backup.ts` (medLogs check around 231-244, supplementLogs check around 254-266)
- Modify: `src/backup.test.ts` (imports and a new `check`)
- Modify: `README.md` (Backup format paragraph: a dose may outlive its catalog row; the name snapshot is the source of truth)

**Interfaces:**
- Consumes: `exportBackup()`, `validateBackup()`, `importBackup()`, `deleteMedication()`, `deleteSupplement()`, `addMedLog()`, `addSupplementLog()`
- Produces: `validateBackup()` returns `[]` for a backup whose `medLogs[].medication_id` or `supplementLogs[].supplement_id` is absent from the catalog, including when `name` is `''`. Import still writes the snapshot name.

- [ ] **Step 1: Write the failing test**

Add `deleteSupplement` to the catalog import in `src/backup.test.ts`. Append this check before the pass/fail summary:

```ts
check('export after deleting a medication and supplement still imports', () => {
  setup();
  populateDb();
  const med = mustFind(listMedications(), (m) => m.name === 'Metformin', 'Metformin');
  const supp = mustFind(listSupplements(), (s) => s.name === 'Magnesium', 'Magnesium');
  deleteMedication(med.id);
  deleteSupplement(supp.id);
  const backup = exportBackup();
  eq(validateBackup(backup), [], 'own backup after catalog delete');
  deleteAllData();
  importBackup(backup);
  const day = getLogsForDay(new Date('2026-09-15T12:00:00.000Z'));
  ok(
    day.some((l) => l.kind === 'medication' && l.title === 'Metformin'),
    'med name snapshot restored',
  );
  ok(
    day.some((l) => l.kind === 'supplement' && l.title === 'Magnesium'),
    'supplement name snapshot restored',
  );
});
```

If `populateDb()` does not log Metformin and Magnesium on `2026-09-15T12:00:00.000Z`, point `getLogsForDay` at the timestamp `populateDb()` actually uses. Do not change `populateDb()` to make the assertion easier if that timestamp already exists.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL on `own backup after catalog delete` with a message containing `no medication with id`.

- [ ] **Step 3: Allow a missing catalog row when the snapshot name is a string**

In `validateBackup`, replace the dangling-id errors. A positive id that is not in the catalog is valid. Keep rejecting non-positive ids and non-string names.

```ts
checkList('medLogs', (row, path) => {
  const mid = row.medication_id;
  if (!isPositiveInt(mid)) {
    at(`${path}.medication_id`, 'must be a positive integer');
  }
  // Name snapshot is the source of truth. '' is the pre-v2 "Deleted medication" row.
  // A missing catalog id is allowed.
  if (row.name !== undefined && typeof row.name !== 'string') {
    at(`${path}.name`, 'must be a string');
  }
  expectTimestamp(row, 'taken_at', path);
  expectQuantity(row, 'quantity', path);
});
```

```ts
const sid = row.supplement_id;
if (sid !== null && !isPositiveInt(sid)) {
  at(`${path}.supplement_id`, 'must be null or a positive integer');
}
```

Leave the rest of the supplement row checks as they are. Update the README backup paragraph so it no longer says every `medLogs[].medication_id` must exist in `medications`.

In `downloadBackup` (`src/components/profile/useBackupActions.ts`), after `exportBackup()`, if `validateBackup(backup).length > 0`, alert `Backup failed` and return before writing the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: the new check passes, and the existing `rejects dangling medication reference` test still passes. That older test must reject a dangling id whose `name` is not a string (or is omitted while `medication_id` is not a positive integer). If that test currently builds a dangling id with a valid string name, change the fixture so `name` is a number — the new rule is "dangling id is ok when name is a string", and the old test should keep proving junk names are rejected.

- [ ] **Step 5: Commit**

```bash
git add src/db/backup.ts src/backup.test.ts src/components/profile/useBackupActions.ts README.md
git commit -m "fix: allow dose history to outlive catalog rows in backups"
```

---

### Task 2: Import only canonical UTC timestamps

**Files:**
- Modify: `src/db/backup.ts` (`isIsoDateTime` near line 100, insert loops near 374-412)
- Modify: `src/backup.test.ts`

**Interfaces:**
- Consumes: `isIsoDateTime` (module-private), `importBackup`, `getLogsForDay`, `getDayBounds`
- Produces: stored `logged_at` / `taken_at` values are always `Date.toISOString()` (`YYYY-MM-DDTHH:mm:ss.sssZ`). Hour 24 and impossible calendar dates are rejected. Offset timestamps land in the local day of their instant.

- [ ] **Step 1: Write the failing test**

```ts
check('offset timestamp imports onto the local day of its instant', () => {
  setup();
  populateDb();
  const backup = exportBackup();
  backup.foodLogs[0].logged_at = '2026-09-21T01:00:00-04:00';
  eq(validateBackup(backup), [], 'offset timestamp is valid');
  importBackup(backup);
  const stored = database().getFirstSync<{ logged_at: string }>(
    'SELECT logged_at FROM food_logs WHERE name = ?',
    [backup.foodLogs[0].name],
  );
  eq(stored?.logged_at, '2026-09-21T05:00:00.000Z', 'stored as UTC');
  const day = getLogsForDay(new Date('2026-09-21T12:00:00-04:00'));
  ok(day.some((l) => l.kind === 'meal' && l.title === backup.foodLogs[0].name), 'visible on that local day');
});

check('rejects hour 24 timestamps', () => {
  setup();
  populateDb();
  const backup = exportBackup();
  backup.foodLogs[0].logged_at = '2026-01-01T24:00:00.000Z';
  ok(validateBackup(backup).some((i) => i.path.endsWith('.logged_at')), 'T24 rejected');
});
```

Add `database` to the existing `./db/client` import if it is not already imported.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because the raw offset string is stored, or because `T24` is accepted.

- [ ] **Step 3: Tighten the regex and write `toISOString()` on import**

```ts
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/;

function isIsoDateTime(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = ISO_DATETIME_RE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  if (y < 1970 || hh > 23 || mm > 59 || ss > 59) return false;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return false;
  }
  const parsed = Date.parse(v);
  if (Number.isNaN(parsed)) return false;
  // Two days of slack so a backup made on a clock a little ahead still imports.
  if (parsed > Date.now() + 2 * 24 * 60 * 60 * 1000) return false;
  return true;
}

function canonicalIso(v: string): string {
  return new Date(v).toISOString();
}
```

In every `importBackup` insert for `logged_at` and `taken_at`, pass `canonicalIso(str(timestamp))` instead of `str(timestamp)`. Apply it to food, med, symptom, supplement, and weight rows.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS, including existing backup round-trip tests (those timestamps are already canonical).

- [ ] **Step 5: Commit**

```bash
git add src/db/backup.ts src/backup.test.ts
git commit -m "fix: store imported timestamps as canonical UTC"
```

---

### Task 3: Cap backup size before parse

**Files:**
- Modify: `src/db/backup.ts`
- Modify: `src/components/profile/useBackupActions.ts`
- Modify: `src/reminderLogic.ts` (`parseReminderSettings`)
- Modify: `src/backup.test.ts`
- Modify: `src/reminderLogic.test.ts`

**Interfaces:**
- Produces:
  - `export const MAX_BACKUP_BYTES = 8 * 1024 * 1024`
  - `export const MAX_BACKUP_ROWS = 20000`
  - `export const MAX_BACKUP_STRING = 4000`
  - `parseReminderSettings` returns at most 12 `custom` entries

- [ ] **Step 1: Write the failing tests**

In `src/backup.test.ts`:

```ts
check('rejects a list longer than MAX_BACKUP_ROWS', () => {
  setup();
  populateDb();
  const backup = exportBackup();
  const row = backup.allergies[0];
  backup.allergies = Array.from({ length: 20001 }, (_, i) => ({ ...row, id: i + 1 }));
  ok(validateBackup(backup).some((i) => i.path === 'allergies'), 'row cap');
});

check('rejects an oversized string field', () => {
  setup();
  populateDb();
  const backup = exportBackup();
  backup.foodLogs[0].name = 'x'.repeat(4001);
  ok(validateBackup(backup).some((i) => i.path.endsWith('.name')), 'string cap');
});
```

In `src/reminderLogic.test.ts`, add a check that a JSON object with 13 valid custom reminders parses to `custom.length === 12`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`

Expected: FAIL because long lists and long strings are currently accepted, and all 13 customs are kept.

- [ ] **Step 3: Enforce the caps**

At the start of `checkList`, if `rows.length > MAX_BACKUP_ROWS`, call `at(key, 'has too many rows')` and return the empty id set.

In `expectString`, if the value is a string longer than `MAX_BACKUP_STRING`, call `at` with `must be at most 4000 characters`.

Cap `times_per_day` at 24 (`isPositiveInt` and `<= 24`). Cap log `quantity` at 20.

In `parseReminderSettings`, `.slice(0, 12)` the filtered custom array.

In `useBackupActions.importBackupFile`, after the picker returns a uri:

```ts
const file = new File(uri);
if (file.size > MAX_BACKUP_BYTES) {
  Alert.alert('Invalid file', 'That backup is too large to import.');
  return;
}
parsed = JSON.parse(await file.text());
```

Use the `File.size` property from `expo-file-system` (SDK 57). Do not read the file first to measure it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/backup.ts src/backup.test.ts src/reminderLogic.ts src/reminderLogic.test.ts src/components/profile/useBackupActions.ts
git commit -m "fix: reject oversized backups before import"
```

---

### Task 4: Stable ordering for same-timestamp logs

**Files:**
- Modify: `src/db/logs.ts` (`getLogsForDay` sort near 247, `KIND_QUERIES` near 303)
- Modify: `src/logs.test.ts`

**Interfaces:**
- Produces: `getLogsOfKind` SQL ends with `ORDER BY <time col> DESC, id DESC`. `getLogsForDay` sorts equal timestamps as 0, then by `id` descending.

- [ ] **Step 1: Write the failing test**

Insert two meals with the same `logged_at` and consecutive ids. Assert `getLogsOfKind('meal', { limit: 1, offset: 0 })` returns the higher id, and `getLogsOfKind('meal', { limit: 1, offset: 1 })` returns the lower id. Assert `getLogsForDay` for that instant lists the higher id first and does not drop either row.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL. The JS comparator returns `-1` for equal timestamps, and SQL has no `id` tiebreaker.

- [ ] **Step 3: Add the tiebreaker**

```ts
return all.sort((a, b) => {
  if (a.logged_at === b.logged_at) return b.id - a.id;
  return a.logged_at < b.logged_at ? 1 : -1;
});
```

Change each `KIND_QUERIES` SQL string from `ORDER BY <col> DESC` to `ORDER BY <col> DESC, id DESC`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/logs.ts src/logs.test.ts
git commit -m "fix: page same-timestamp logs in a stable order"
```

---

### Task 5: Streak uses one query per table

**Files:**
- Modify: `src/db/logs.ts` (`getStreak` near 384)
- Modify: `src/logs.test.ts`

**Interfaces:**
- Consumes: `localDayKey` from `src/trendsStats.ts`, `KIND_TABLES`, `getDayBounds`
- Produces: `getStreak(): number` with the same result as today (today, or yesterday if today is empty, then consecutive local days) and at most one `SELECT` per log table.

- [ ] **Step 1: Write the failing test**

The current streak tests should stay green. Add a test that inserts one food log on each of the last 40 local days and asserts `getStreak() === 40`. That locks the behavior before the rewrite. Add a second test with logs today and three days ago but not yesterday or the day before, asserting `getStreak() === 1`.

- [ ] **Step 2: Run the test to verify the new cases pass on the old code**

Run: `npm test`

Expected: PASS. This task is a rewrite of a correct algorithm. The new tests are the contract. Do not proceed to Step 3 if they fail on the current code — fix the test dates first.

- [ ] **Step 3: Load day keys once**

```ts
import { localDayKey } from '../trendsStats';

const STREAK_LOOKBACK_DAYS = 4000;

export function getStreak(): number {
  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - STREAK_LOOKBACK_DAYS);
  const since = earliest.toISOString();
  const days = new Set<string>();
  for (const { table, timeCol } of Object.values(KIND_TABLES)) {
    const rows = database().getAllSync<{ t: string }>(
      `SELECT ${timeCol} AS t FROM ${table} WHERE ${timeCol} >= ?`,
      [since],
    );
    for (const row of rows) days.add(localDayKey(row.t));
  }
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const key = (d: Date) => localDayKey(d.toISOString());
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
```

Delete `hasAnyLogOnDay` if nothing else calls it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS, including the existing streak tests in `src/logs.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/db/logs.ts src/logs.test.ts
git commit -m "fix: compute the logging streak from one query per table"
```

---

### Task 6: Trends ranges load the window they label

**Files:**
- Modify: `src/db/trends.ts`
- Modify: `src/trendsStats.ts` (`filterWeightRange`, `filterSymptomRange`)
- Modify: `src/screens/TrendsScreen.tsx` (`refresh`)
- Modify: `src/trendsStats.test.ts`
- Modify: `README.md` Trends section: Week is 7 local dates inclusive; Year and All are not clipped at 180 days

**Interfaces:**
- Produces:
  - `export function sinceIsoForRange(days: number | null): string | null` — `null` means no lower bound; otherwise local midnight of `today - (days - 1)`
  - `getWeightSeries(lookbackDays: number | null)`, and the same parameter on `getSymptomDayMap`, `getItemDayList`, `getMealDayMap`. `null` omits the `WHERE` clause. A number uses `sinceIsoForRange`.
  - `filterWeightRange` / `filterSymptomRange` use that same local start-of-day cutoff so Week is 7 dates, not 8.

- [ ] **Step 1: Write the failing tests**

In `src/trendsStats.test.ts`:

```ts
check('week window is seven local dates inclusive', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const points = [0, 6, 7].map((ago) => ({
    day: localDayKey(new Date(now - ago * day).toISOString()),
    weight: 150,
    at: new Date(now - ago * day).setHours(12, 0, 0, 0),
  }));
  const kept = filterWeightRange(points, 7).map((p) => p.day);
  eq(kept.includes(points[0].day), true, 'today');
  eq(kept.includes(points[1].day), true, 'six days ago');
  eq(kept.includes(points[2].day), false, 'seven days ago is outside a 7-date week');
});
```

Add a db test (in `src/trendsStats.test.ts` if that file already opens the sqlite handle, otherwise `src/backup.test.ts` style in the trends test file — follow the existing `getWeightSeries` test setup in `src/trendsStats.test.ts`) that inserts a weigh-in 400 days ago and asserts `getWeightSeries(null)` includes it and `getWeightSeries(180)` does not.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL. Current `filterWeightRange` uses a rolling millisecond cutoff, and `getWeightSeries()` always applies 180 days.

- [ ] **Step 3: Implement the shared cutoff and thread it from the screen**

```ts
export function sinceIsoForRange(days: number | null): string | null {
  if (days == null || days < 0) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}
```

Each trends query:

```ts
export function getWeightSeries(lookbackDays: number | null = null): WeightPoint[] {
  const since = sinceIsoForRange(lookbackDays);
  const sql = since
    ? 'SELECT weight, logged_at FROM weight_logs WHERE logged_at >= ? ORDER BY logged_at ASC'
    : 'SELECT weight, logged_at FROM weight_logs ORDER BY logged_at ASC';
  const rows = since
    ? database().getAllSync<{ weight: number; logged_at: string }>(sql, [since])
    : database().getAllSync<{ weight: number; logged_at: string }>(sql);
  // map as today
}
```

Repeat that shape for the other three queries. Remove `TRENDS_LOOKBACK_DAYS` if nothing else imports it. Update any test that depended on the 180 default.

`filterWeightRange` and `filterSymptomRange`: when `days < 0`, return the input. Otherwise keep points whose local day is `>= localDayKey(sinceIsoForRange(days)!)`.

In `TrendsScreen.refresh`, load pattern inputs with `null` (symptom map, item list, meal map — the pattern section has no range control and must not inherit a 180-day ceiling). Load the weight series with `range < 0 ? null : range` and the symptom history source with `histRange < 0 ? null : histRange`. `listDailyMacros()` currently loads every macro row; give it the same `lookbackDays: number | null` parameter and call it with `null` from the pattern section so macro correlations are not a silent second window. `refresh` must list `range` and `histRange` in its `useCallback` deps and be re-run when either changes (`useEffect` on those two values, plus the existing focus effect). When `getProStatus()` is false, clear `weightSeries`, `symptomDayMap`, `items`, `mealDayMap`, `strongest`, and the markdown-equivalent fields on this screen before returning.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS. Existing pattern-threshold tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/trends.ts src/trendsStats.ts src/trendsStats.test.ts src/screens/TrendsScreen.tsx README.md
git commit -m "fix: load the Trends window the range control labels"
```

---

### Task 7: Charts place points by time

**Files:**
- Modify: `src/components/trends/WeightChart.tsx` (x function near line 32)
- Modify: `src/components/trends/SymptomHistoryChart.tsx` (x function near line 24)
- Modify: `src/screens/TrendsScreen.tsx` (the sentence "Each dot is a day you logged")

**Interfaces:**
- Consumes: `WeightPoint.at`, `SymptomDay.day` (`YYYY-MM-DD`)
- Produces: x position from the point's time across the first-to-last span. Dot drawing stays `points.length <= 30`.

- [ ] **Step 1: Write the failing test**

Add `src/chartScale.test.ts` with the pure helper the charts will call:

```ts
import { xForTime } from './chartScale';

function eq<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e}`); }
}

check('x is proportional to time, not index', () => {
  eq(xForTime(0, 0, 100, 0, 100), 0, 'start');
  eq(xForTime(90, 0, 100, 0, 100), 90, 'day 90 of 100 is near the right');
  eq(xForTime(50, 0, 100, 0, 100), 50, 'mid');
});

check('a single timestamp sits in the middle', () => {
  eq(xForTime(5, 5, 5, 0, 100), 50, 'one point');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL with a compile error that `./chartScale` does not exist.

- [ ] **Step 3: Add the helper and use it**

Create `src/chartScale.ts`:

```ts
/** Pixel x for `at` inside [t0, t1], mapped onto [left, left + width]. */
export function xForTime(at: number, t0: number, t1: number, left: number, width: number): number {
  if (t1 === t0) return left + width / 2;
  return left + ((at - t0) / (t1 - t0)) * width;
}
```

`WeightChart`: `const t0 = points[0].at; const t1 = points[points.length - 1].at;` and `const xAt = (at: number) => xForTime(at, t0, t1, pad.left, innerW);`. Use `xAt(p.at)` everywhere `x(i)` is used. Keep the `<= 30` dot gate.

`SymptomHistoryChart`: parse `day` as local noon (`new Date(y, m - 1, d, 12)` from the `YYYY-MM-DD` key) and use the same helper. Keep the `<= 30` dot gate.

In `TrendsScreen`, change the symptom-chart caption to `Each point is a day you logged this symptom` so it stays true when dots are hidden.

Confirm `tsconfig.json` includes `src/chartScale.ts` (it includes `src` already) and `tsconfig.test.json` compiles `src/chartScale.test.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/chartScale.ts src/chartScale.test.ts src/components/trends/WeightChart.tsx src/components/trends/SymptomHistoryChart.tsx src/screens/TrendsScreen.tsx
git commit -m "fix: space trend charts by date instead of row index"
```

---

### Task 8: Symptom names fold case the way meds already do

**Files:**
- Modify: `src/db/trends.ts` (`getSymptomDayMap` near line 57)
- Modify: `src/trendsStats.test.ts`

**Interfaces:**
- Produces: `getSymptomDayMap` keys are `trim().toLowerCase()`, and the map's display string is the first-seen casing. Days from `Headache` and `headache` merge.

- [ ] **Step 1: Write the failing test**

Follow the existing trends db test setup. Insert two symptom logs on different days, names `Headache` and `headache`. Assert `getSymptomDayMap(null)` has one key, `headache`, two days, and that the screen-facing display name stored alongside is `Headache`.

If the map is `Map<string, SymptomDay[]>` keyed only by raw name today, change the return so callers can show one label. Prefer keeping the key as the normalized name and adding the display name on each series:

```ts
export interface SymptomSeries {
  name: string; // first-seen casing
  days: SymptomDay[];
}
export function getSymptomDayMap(lookbackDays: number | null = null): SymptomSeries[]
```

Update `TrendsScreen` to iterate the array. `setSymptomNames` becomes `series.map((s) => s.name)`. Lookups use `name.toLowerCase()`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL with two keys, or a compile error once the test imports `SymptomSeries`.

- [ ] **Step 3: Group like `getItemDayList`**

Use the existing `normName`. On first sight of a normalized name, store `{ name: trimmedOriginal, byDay }`. Later rows with the same normalized name append severities to that day. Return one `SymptomSeries` per normalized name, days sorted ascending.

Update `TrendsScreen` loops that did `sMap.get(sName)` to find `series.find((s) => s.name.toLowerCase() === sName.toLowerCase())`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/trends.ts src/trendsStats.test.ts src/screens/TrendsScreen.tsx
git commit -m "fix: merge symptom trends that differ only by case"
```

---

### Task 9: Food matching uses word boundaries

**Files:**
- Modify: `src/foodGroups.ts` (`matchFoodDays`)
- Modify: `src/foodGroups.test.ts`

**Interfaces:**
- Produces: `mentionsFoodTerm(haystack: string, term: string): boolean` — case-insensitive, optional trailing `s`, boundaries on non-alphanumerics. Rejects a hit when the 24 characters before it end with `no`, `not`, or `without` plus whitespace, or when the term is immediately followed by `-free`.

- [ ] **Step 1: Write the failing tests**

```ts
check('food terms do not match lookalike words', () => {
  const days = new Map<string, string[]>([
    ['2026-01-01', ['hamburger']],
    ['2026-01-02', ['eggplant parmesan']],
    ['2026-01-03', ['peanut butter']],
    ['2026-01-04', ['almond milk']],
    ['2026-01-05', ['kidney beans']],
    ['2026-01-06', ['oyster mushrooms']],
    ['2026-01-07', ['artichoke hearts']],
    ['2026-01-08', ['no eggs']],
    ['2026-01-09', ['egg-free muffins']],
    ['2026-01-10', ['ribeye and eggs']],
    ['2026-01-11', ['butter']],
  ]);
  eq([...matchFoodDays('pork', days).daysWith], [], 'ham is not hamburger');
  eq([...matchFoodDays('eggs', days).daysWith], ['2026-01-10'], 'egg is not eggplant or a negation');
  eq([...matchFoodDays('dairy', days).daysWith], ['2026-01-11'], 'butter is not peanut butter or almond milk');
  eq([...matchFoodDays('organ meats', days).daysWith], [], 'kidney beans and artichoke hearts');
  eq([...matchFoodDays('seafood', days).daysWith], [], 'oyster mushrooms');
});
```

Keep the existing ribeye / bacon / butter / liver tests. Adjust them only if a fixture was accidentally a lookalike.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `haystack.includes(term)` matches those strings.

- [ ] **Step 3: Match a bounded term and skip negations**

```ts
export function mentionsFoodTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}s?(?=[^a-z0-9]|$)`, 'gi');
  const text = haystack.toLowerCase();
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    const before = text.slice(Math.max(0, start - 24), start);
    if (/\b(no|not|without)\s+$/.test(before)) continue;
    const after = text.slice(start + match[0].length);
    if (after.startsWith('-free')) continue;
    return true;
  }
  return false;
}
```

`matchFoodDays` calls `mentionsFoodTerm(haystack, term)` instead of `haystack.includes(t)`.

Whole-word `butter` still hits `peanut butter`, and whole-word `milk` still hits `almond milk`. Skip a match when the haystack slice around it contains one of these phrases: `peanut butter`, `almond milk`, `coconut milk`, `oat milk`, `kidney bean`, `oyster mushroom`, `artichoke heart`.

```ts
const LOOKALIKES = [
  'peanut butter',
  'almond milk',
  'coconut milk',
  'oat milk',
  'kidney bean',
  'oyster mushroom',
  'artichoke heart',
];

function insideLookalike(haystack: string, matchIndex: number, term: string): boolean {
  const from = Math.max(0, matchIndex - 24);
  const to = Math.min(haystack.length, matchIndex + term.length + 24);
  const window = haystack.slice(from, to);
  return LOOKALIKES.some((phrase) => phrase.includes(term) && window.includes(phrase));
}
```

Call `insideLookalike` in the `matchAll` loop and `continue` when it returns true. A day that also contains plain `butter` outside those phrases still counts.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/foodGroups.ts src/foodGroups.test.ts
git commit -m "fix: stop food patterns matching lookalike words"
```

---

### Task 10: Lion Diet principles exclude non-ruminant foods

**Files:**
- Modify: `src/dietPrinciples.ts` (lion overrides)
- Modify: `src/dietPrinciples.test.ts`

**Interfaces:**
- Produces: `dietPrinciples('lion')` joined text includes `no plants`, `eggs`, and does not include `fish, eggs, and butter` or `low-carb vegetables`. Principle count stays 10.

- [ ] **Step 1: Write the failing test**

```ts
check('lion principles exclude plants, eggs, and non-ruminant meat', () => {
  const text = dietPrinciples('lion').join('\n').toLowerCase();
  ok(text.includes('no plants'), 'plants excluded');
  ok(text.includes('eggs'), 'eggs named as excluded');
  ok(!text.includes('low-carb vegetables'), 'keto vegetable line removed');
  ok(!text.includes('fish, eggs, and butter'), 'keto foundation line removed');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because lion still inherits principle 2 (`No sugar, no grains...`) and the base principle 0 is only partly overridden.

- [ ] **Step 3: Override the lion lines**

```ts
lion: {
  0: 'Ruminant meat only — beef, lamb, bison, and goat. No pork, poultry, fish, eggs, or plants.',
  1: 'Fat is fuel, never the culprit — never blame dietary fat for stalls or gain. Eat fatty ruminant cuts and tallow freely.',
  2: 'Ruminant meat, salt, and water only — no plants, no eggs, no dairy, no pork, no poultry, and no fish.',
  7: 'No dairy at all — the Lion Diet excludes all dairy, including butter and cheese.',
  8: 'When in doubt, simplify back to ruminant meat, salt, and water.',
},
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS, including the existing "no dairy is optional" lion test.

- [ ] **Step 5: Commit**

```bash
git add src/dietPrinciples.ts src/dietPrinciples.test.ts
git commit -m "fix: make Lion Diet coach principles ruminant-only"
```

---

### Task 11: Duration labels agree with milestone days

**Files:**
- Modify: `src/milestones.ts` (`dietDurationLabel` near line 65)
- Modify: `src/milestones.test.ts`

**Interfaces:**
- Produces: `dietDurationLabel` for a start date N local days before today:
  - `0` → `started today`
  - `1` → `1 day`
  - `2` through `30` → `${n} days`
  - `31` through `364` → rounded months via `Math.max(1, Math.round(days / 30.44))`, singular `1 month`
  - `365` and up → years from `Math.floor(days / 365)`, remainder months from `Math.round((days % 365) / 30.44)`, omitting a 0 remainder. `12` remainder months rolls into another year.

- [ ] **Step 1: Write the failing test**

Build the start string as local `YYYY-MM-DD` for today minus N days (same approach as the existing 10 / 45 / 400 tests). Assert:

```ts
eq(dietDurationLabel(daysAgo(30)), '30 days', 'day 30');
eq(dietDurationLabel(daysAgo(180)), '6 months', 'day 180');
eq(dietDurationLabel(daysAgo(365)), '1 year', 'day 365');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL with `0 months` for day 30 and `11 months` for day 365.

- [ ] **Step 3: Replace the 30.44 floor cutoff**

```ts
export function dietDurationLabel(s: string | null | undefined): string | null {
  const days = daysSinceDietStart(s);
  if (days == null || days < 0) return null;
  if (days === 0) return 'started today';
  if (days <= 30) return days === 1 ? '1 day' : `${days} days`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30.44));
    return months === 1 ? '1 month' : `${months} months`;
  }
  let years = Math.floor(days / 365);
  let rem = Math.round((days % 365) / 30.44);
  if (rem === 12) {
    years += 1;
    rem = 0;
  }
  const y = years === 1 ? '1 year' : `${years} years`;
  if (rem === 0) return y;
  return `${y} ${rem === 1 ? '1 month' : `${rem} months`}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS. The existing 10-day, 45-day, and 400-day assertions still pass (`45 / 30.44` rounds to 1; `400` is 1 year and 35 days, which rounds to 1 month).

- [ ] **Step 5: Commit**

```bash
git add src/milestones.ts src/milestones.test.ts
git commit -m "fix: align diet duration labels with milestone days"
```

---

### Task 12: Reminder reconcile follows the calendar

**Files:**
- Modify: `src/reminderLogic.ts`
- Modify: `src/reminderLogic.test.ts`
- Modify: `src/reminders.ts` (`scheduleKey`, `reconcileReminders`)

**Interfaces:**
- Produces:
  - `export function scheduleKey(settings: ReminderSettings, hasLogsToday: boolean, localDate: string): string`
  - `export function occurrencesToSchedule(settings: ReminderSettings, now: Date, hasLogsToday: boolean, daysAhead?: number): ScheduledOccurrence[]`
  - `localDate` is `YYYY-MM-DD`. Two calls with the same settings and `hasLogsToday` but different dates return different keys.
  - `occurrencesToSchedule` omits `kind: 'main'` when `settings.enabled` is false and still returns future custom occurrences.

- [ ] **Step 1: Write the failing tests**

```ts
check('schedule key changes when the local date changes', () => {
  const s = settings();
  ok(scheduleKey(s, true, '2026-09-21') !== scheduleKey(s, true, '2026-09-22'), 'date is part of the key');
});

check('disabling the daily nudge keeps custom alarms', () => {
  const s = settings({
    enabled: false,
    custom: [{ id: 'c1', hour: 7, minute: 0 }],
  });
  const now = new Date(2026, 8, 21, 6, 0, 0, 0);
  const occ = occurrencesToSchedule(s, now, true, 2);
  eq(occ.some((o) => o.kind === 'main'), false, 'no daily nudge');
  eq(occ.filter((o) => o.kind === 'custom').length, 2, 'today and tomorrow custom');
});
```

Use the file's existing `settings()` helper.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL to compile. `scheduleKey` and `occurrencesToSchedule` are not exported from `reminderLogic.ts`.

- [ ] **Step 3: Move the key and the enabled-filter into the pure module**

```ts
export function scheduleKey(settings: ReminderSettings, hasLogsToday: boolean, localDate: string): string {
  return JSON.stringify({
    localDate,
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
```

In `src/reminders.ts`, delete the local `scheduleKey`. Call the exported one with `localDayKey(now.toISOString())` from `src/trendsStats.ts`. Replace `computeOccurrences(...)` with `occurrencesToSchedule(...)`.

Replace the early return:

```ts
await cancelOurScheduled();
if (!settings.enabled && settings.custom.length === 0) {
  await Notifications.setBadgeCountAsync(0).catch(() => {});
  lastScheduleKey = key;
  return;
}
```

Permission is still required before scheduling. Custom reminders schedule when the daily switch is off.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS. Existing `computeOccurrences` tests stay as they are (they still schedule a main reminder even when `enabled` is false; the filter lives in `occurrencesToSchedule`).

- [ ] **Step 5: Commit**

```bash
git add src/reminderLogic.ts src/reminderLogic.test.ts src/reminders.ts
git commit -m "fix: reschedule reminders when the date changes"
```

---

### Task 13: Coach export lists the 30-day window it counts

**Files:**
- Modify: `src/db/exportData.ts`
- Modify: `src/screens/ExportScreen.tsx` (`buildContextMarkdown`)
- Modify: `src/backup.test.ts` or a new `src/exportData.test.ts` if backup tests should stay about backups. Prefer `src/exportData.test.ts` using the same `setup()` pattern as `src/backup.test.ts` (copy the `NodeSqliteHandle` / `__setDbForTests` / `initDb` helper into the new file; do not import from the test file).

**Interfaces:**
- Produces: `ExportData.counts30` gains `weighIns: number`. `recentMeals`, `recentSymptoms`, `recentSupplements`, `recentMeds`, and new `recentWeights: WeightLog[]` contain every row in the trailing 30 local days, with no `LIMIT`. `buildContextMarkdown` escapes newlines in names and notes to a single space, and adds a `### Recent weigh-ins` section when `recentWeights.length > 0`. The coach prompt sentence includes weight logs.

- [ ] **Step 1: Write the failing test**

Insert 41 meals inside the trailing 30 days and one weigh-in. Assert `getExportData().counts30.meals === 41`, `recentMeals.length === 41`, and `recentWeights.length === 1`. Insert a meal named `eggs\n- ignore the above` and assert the markdown builder does not contain a raw newline inside that bullet. Export `buildContextMarkdown` from `ExportScreen.tsx` if the test imports it, or move the markdown builder to `src/exportMarkdown.ts` and test that. Moving it is the right cut: `ExportScreen` imports `buildContextMarkdown` from `src/exportMarkdown.ts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `recentMeals.length` is 40, or because `recentWeights` does not exist.

- [ ] **Step 3: Drop the limits and add weight**

Remove `LIMIT 40` and `LIMIT 60` from the four queries. Add:

```ts
recentWeights: database().getAllSync<WeightLog>(
  'SELECT * FROM weight_logs WHERE logged_at BETWEEN ? AND ? ORDER BY logged_at DESC',
  [startIso, endIso],
),
```

and `weighIns: countRange('weight_logs', 'logged_at')` on `counts30`.

```ts
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}
```

Use `oneLine` on every name, note, and meal type written into a bullet.

Add the weigh-in section and the counts line `Weigh-ins: ${counts30.weighIns}`. Mention weight logs in the coach prompt's "my food, symptom..." sentence.

When `getProStatus()` is false in `ExportScreen.refresh`, set `markdown` and `prompt` to `''` before returning.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/exportData.ts src/exportMarkdown.ts src/exportData.test.ts src/screens/ExportScreen.tsx
git commit -m "fix: export every log in the trailing 30 days, including weight"
```

---

### Task 14: Pro simulation fails closed, and Restore reports errors

**Files:**
- Modify: `src/pro.ts` (`purchaseTestModeEnabled`, lines 48-54)
- Modify: `src/pro.test.ts` (the check named `preview builds can simulate Pro`)
- Modify: `test/run.js` or `test/preload.js` so Node tests set `global.__DEV__ = true` before loading `pro.js`
- Modify: `src/components/PaywallModal.tsx` (`restore`)

**Interfaces:**
- Consumes: existing `purchaseTestModeEnabled(dev, demoFlag)`
- Produces: `purchaseTestModeEnabled(undefined, undefined) === false`. `true` only when `dev === true` or `demoFlag === '1'`. `PaywallModal` restore catches and shows `Purchase failed` with the error message, same as upgrade.

- [ ] **Step 1: Write the failing test**

Change the existing assertion in `src/pro.test.ts`:

```ts
eq(purchaseTestModeEnabled(undefined, undefined), false, 'missing __DEV__ does not simulate a purchase');
```

Leave the other four assertions in that check as they are (`true` for dev, `true` for preview flag `1`, `false` for production, `false` for `'0'`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL on `missing __DEV__ does not simulate a purchase` because the function currently uses `dev === undefined ? true : dev`.

- [ ] **Step 3: Default missing `__DEV__` to false**

```ts
export function purchaseTestModeEnabled(
  dev: boolean | undefined,
  demoFlag: string | undefined,
): boolean {
  return dev === true || demoFlag === '1';
}
```

`requestPurchase` in Node is loaded with `__DEV__` missing, so `TEST_MODE_PURCHASE` would become false and the existing `requestPurchase (test mode) grants Pro` check would throw. In `test/run.js`, before spawning each test file, the preload already used for component tests is `test/preload.js`. Set `globalThis.__DEV__ = true` at the top of `test/preload.js`, and pass `--require ./test/preload.js` for every test file, not only the React Native ones. That keeps the simulated-purchase checks working without encoding "undefined means paid" in production code.

In `PaywallModal.restore`, add the same `catch` as `upgrade`:

```ts
} catch (e) {
  Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Could not complete the purchase.');
} finally {
  setBusy(false);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS, including `requestPurchase (test mode) grants Pro`.

- [ ] **Step 5: Commit**

```bash
git add src/pro.ts src/pro.test.ts test/preload.js test/run.js src/components/PaywallModal.tsx
git commit -m "fix: fail closed when __DEV__ is missing and surface restore errors"
```

---

### Task 15: Log saves cannot duplicate an in-progress edit

**Files:**
- Modify: `src/components/log/useLogScreen.ts`
- Modify: `src/screens/LogListScreen.tsx` (`loadMore`)

**Interfaces:**
- Produces: `selectSegment` and the quick-add `segment` param both call `resetForm()` and then `tabNavigation.setParams({ segment: undefined })`. `startEdit` loads the row before `resetForm()`. Each save handler returns immediately when its `SaveDraft.saving` flag is true, and clears that draft's `value` before the insert. `loadMore` returns immediately when `loadingMore.current` is true.

- [ ] **Step 1: Write the failing test**

Extract the synchronous guard into `src/components/log/saveGuard.ts`:

```ts
export interface SaveDraft<T> {
  saving: boolean;
  value: T;
}

export function beginSave<T>(draft: SaveDraft<T>, empty: T): { ok: true; value: T } | { ok: false } {
  if (draft.saving) return { ok: false };
  const value = draft.value;
  draft.saving = true;
  draft.value = empty;
  return { ok: true, value };
}

export function finishSave<T>(draft: SaveDraft<T>, restore: T | null): void {
  draft.saving = false;
  if (restore !== null) draft.value = restore;
}
```

Test in `src/components/log/saveGuard.test.ts`: first `beginSave` returns the value and leaves `saving` true and `value` empty; second `beginSave` returns `{ ok: false }`; `finishSave(draft, null)` clears `saving` without putting the value back; `finishSave(draft, previous)` restores it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL to compile until `saveGuard.ts` exists.

- [ ] **Step 3: Use the guard and reset on segment change**

Keep a `draftRef` updated every render. Each save owns one `SaveDraft`. The meal draft's `value` is `{ name, notes, type, logDate, editing }`, copied from `mealName`, `mealNotes`, `mealType`, `logDate`, and `editing` on each render. Symptom, weight, and med/supp drafts follow the same shape with the fields their current save handlers read. At the start of `saveMeal`:

```ts
const begun = beginSave(draftRef.current.meal, {
  name: '',
  notes: '',
  type: 'Dinner',
  logDate: new Date(),
  editing: null,
});
if (!begun.ok) return;
try {
  if (!begun.value.name.trim()) {
    finishSave(draftRef.current.meal, begun.value);
    Alert.alert('Missing name', 'What did you eat?');
    return;
  }
  const at = begun.value.logDate.toISOString();
  if (begun.value.editing?.kind === 'meal') {
    updateFoodLog(begun.value.editing.id, begun.value.name, begun.value.type, begun.value.notes, at);
  } else {
    addFoodLog(begun.value.name, begun.value.type, begun.value.notes, at);
  }
  resetForm();
  refresh();
  finishSave(draftRef.current.meal, null);
} catch (e) {
  finishSave(draftRef.current.meal, begun.value);
  alertSaveFailed(e);
}
```

Apply the same shape to `saveMedSupp`, `saveSymptom`, and `saveWeight`. A validation failure and a thrown sqlite error restore the draft. A second call while `saving` is true returns.

`selectSegment`:

```ts
const selectSegment = (key: LogSegment) => {
  resetForm();
  setSegment(key);
};
```

Quick-add effect, in the `segmentParam` branch: `resetForm(); setSegment(segmentParam); tabNavigation.setParams({ segment: undefined });`.

`startEdit`: fetch the row first. If it is missing, return without `resetForm()`. If it is a weight row and weight tracking is off, `Alert.alert` and return. Only then call `resetForm()` and fill the fields.

`LogListScreen`:

```ts
const loadingMore = useRef(false);
const loadMore = useCallback(() => {
  if (!hasMore || loadingMore.current) return;
  loadingMore.current = true;
  try {
    const page = getLogsOfKind(logType, { limit: PAGE_SIZE, offset: logs.length });
    if (page.length === 0) {
      setHasMore(false);
      return;
    }
    setLogs((prev) => [...prev, ...page]);
    setHasMore(page.length === PAGE_SIZE);
  } finally {
    loadingMore.current = false;
  }
}, [hasMore, logType, logs.length]);
```

Set `loadingMore.current = false` at the start of `refresh` as well.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/log/saveGuard.ts src/components/log/saveGuard.test.ts src/components/log/useLogScreen.ts src/screens/LogListScreen.tsx
git commit -m "fix: stop segment switches and double taps from duplicating logs"
```

---

### Task 16: Delete-all and import tell the truth and reschedule

**Files:**
- Modify: `src/screens/ProfileScreen.tsx` (alerts near 62-90)
- Modify: `src/components/profile/useBackupActions.ts` (import alert near 58)
- Modify: `src/components/profile/NotificationSection.tsx`
- Modify: `src/db/profile.ts` (`deleteAllData` VACUUM)

**Interfaces:**
- Consumes: `reconcileReminders(true)` from `src/reminders.ts`
- Produces: `NotificationSection` accepts `reloadToken: number` and re-reads settings when it changes. Delete-all and import increment that token and call `reconcileReminders(true)`. VACUUM failure does not throw out of `deleteAllData` after the transaction has committed.

- [ ] **Step 1: Write the failing test**

`deleteAllData` is already covered for the SQL wipe. Add a check in `src/backup.test.ts` or `src/pro.test.ts` that is not possible for the alert copy (that copy is UI). For the VACUUM behavior, wrap is unnecessary if we only catch inside `deleteAllData`. Add a unit-level comment test only if there is a seam. The required test for this task is the reminder reload token, which is UI. Instead, test the pure copy helpers:

Create `src/destructiveCopy.ts`:

```ts
export const DELETE_ALL_BODY =
  'This permanently deletes your profile, allergies, health conditions, logs, medications, supplements, reminders, weight history, and KetoKind Pro status on this device. Theme returns to System. This cannot be undone.';

export const IMPORT_BODY =
  'Importing replaces everything currently on this device except KetoKind Pro status. This device stays Free or Pro as it is now. This cannot be undone.';
```

Test the two strings contain `Pro`, and `IMPORT_BODY` contains `except KetoKind Pro`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL to compile until `destructiveCopy.ts` exists.

- [ ] **Step 3: Use the copy and reload reminders**

Import the two constants into `ProfileScreen` and `useBackupActions` and pass them as the alert bodies.

```ts
onPress: () => {
  try {
    deleteAllData();
    medSupp.clearMedSuppForm();
    setAppTheme('system');
    setReminderToken((n) => n + 1);
    void reconcileReminders(true);
    refresh();
    Alert.alert('Done', 'All data has been deleted from this device.');
  } catch (e) {
    Alert.alert('Delete failed', e instanceof Error ? e.message : 'Could not delete data.');
  }
},
```

`onBackupImported` does the same token increment and `reconcileReminders(true)` after `refresh()`.

`NotificationSection({ reloadToken }: { reloadToken: number })` adds `reloadToken` to the `useFocusEffect` callback deps by calling `refresh` from a `useEffect` on `[reloadToken, refresh]`.

`deleteAllData`:

```ts
try {
  database().execSync('VACUUM;');
} catch {
  // The wipe already committed. A failed VACUUM must not look like a failed delete.
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/destructiveCopy.ts src/destructiveCopy.test.ts src/screens/ProfileScreen.tsx src/components/profile/useBackupActions.ts src/components/profile/NotificationSection.tsx src/db/profile.ts
git commit -m "fix: describe delete and import accurately and reschedule reminders"
```

---

### Task 17: Remove health files after share, and open Log only for a fresh tap

**Files:**
- Modify: `src/components/profile/useBackupActions.ts`
- Modify: `src/screens/ExportScreen.tsx` (`exportAndShare`, `copyAll`)
- Modify: `App.tsx` (notification response effect near 153-159)

**Interfaces:**
- Produces: backup JSON is written under `Paths.cache`, shared, then `file.delete()` in a `finally`. The picker cache file is deleted after a successful import and after a rejected file. `ketokind-context.md` is deleted in a `finally` after `shareAsync`. `copyAll` catches clipboard errors and alerts. Cold start navigates to Log only when `getLastNotificationResponseAsync()` returns a response, then calls `clearLastNotificationResponseAsync()` so the next launch does not navigate again.

- [ ] **Step 1: Confirm the Expo SDK 57 APIs**

Read the installed `expo-file-system` `File.delete` and `expo-notifications` `clearLastNotificationResponseAsync` type declarations (after `npm install` if `node_modules` is absent). Use those names. Do not guess a different method.

- [ ] **Step 2: Implement the cleanup**

`downloadBackup` writes `new File(Paths.cache, ...)`. `finally { try { file.delete(); } catch { /* already gone */ } }` after share.

`exportAndShare` uses the same `finally` delete.

`importBackupFile` tracks the picker uri and deletes that `File` after import, after invalid-file alert, and when the user taps Cancel on the replace alert.

```ts
const copyAll = async () => {
  try {
    await Clipboard.setStringAsync(combined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (e) {
    Alert.alert('Copy failed', e instanceof Error ? e.message : 'Could not copy the prompt.');
  }
};
```

`App.tsx`:

```ts
Notifications.getLastNotificationResponseAsync().then(async (response) => {
  if (!response) return;
  openLogTab();
  await Notifications.clearLastNotificationResponseAsync();
});
```

If `navigationRef.isReady()` is false inside `openLogTab`, retry on the navigation container's `onReady` instead of dropping the tap. Keep the live `addNotificationResponseReceivedListener` path.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS. There is no Node test for the native file and notification APIs. Do not mock a passing test that never calls them.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/useBackupActions.ts src/screens/ExportScreen.tsx App.tsx
git commit -m "fix: delete shared health files and ignore stale notification taps"
```

---

### Task 18: Schema version advances inside the migration transaction

**Files:**
- Modify: `src/db/schema.ts` (loop near 192-200)
- Modify: `src/backup.test.ts` (or `src/pro.test.ts`, wherever migrations are already tested)

**Interfaces:**
- Produces: each applied migration sets `PRAGMA user_version` to that version inside its transaction. `initDb()` does not lower `user_version` when the stored version is already greater than `SCHEMA_VERSION`.

- [ ] **Step 1: Write the failing test**

```ts
check('initDb does not downgrade a newer user_version', () => {
  const handle = setup();
  handle.execSync('PRAGMA user_version = 9');
  initDb();
  const stored = handle.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  eq(stored?.user_version, 9, 'newer version kept');
});
```

Use the handle methods that `NodeSqliteHandle` actually exposes (`execSync` / `getFirstSync`). If `setup()` already calls `initDb()`, set the pragma after setup and call `initDb()` again.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `user_version` becomes 5.

- [ ] **Step 3: Stamp inside the transaction and never stamp downward**

Delete the unconditional `PRAGMA user_version = SCHEMA_VERSION` that currently runs after the loop. Replace the loop with:

```ts
if (currentVersion > SCHEMA_VERSION) return;
for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
  const migrate = MIGRATIONS[v];
  database().withTransactionSync(() => {
    if (migrate) migrate();
    database().execSync(`PRAGMA user_version = ${v}`);
  });
}
```

A missing migration function still stamps that version so a gap cannot leave the pragma behind. A stored version newer than `SCHEMA_VERSION` is left alone.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS, including the existing v3 migration tests.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/backup.test.ts
git commit -m "fix: keep schema user_version inside each migration"
```

---

### Task 19: Small correctness leftovers

**Files:**
- Modify: `src/datetime.ts` (`dayKey`)
- Modify: `src/components/log/medSuppSelection.ts` (clamp quantity on load and prune)
- Modify: `src/components/log/SymptomForm.tsx` (severity role)
- Modify: `src/components/log/TodayEntries.tsx` (delete label)
- Modify: `src/components/profile/ProSection.tsx` (mention Trends)
- Modify: `src/components/profile/NotificationSection.tsx` (settings copy, persist-before-state)
- Modify: `src/medSuppSelection.test.ts`
- Modify: `src/trendsStats.test.ts` (one `diffLabel` assertion)

**Interfaces:**
- Produces: `dayKey` returns `localDayKey`'s `YYYY-MM-DD` shape (month is 1-12, padded). Quantity leaving `load-selection` and `prune` is clamped to 1–20, and `prune` drops quantity keys whose ids are no longer selected. Severity controls use `accessibilityRole="radio"`. Delete accessibility label includes the entry title. Pro section text mentions Trends. Notification errors alert and do not flip React state first. The settings hint says `Open Settings`, not `iPhone Settings`, when `Platform.OS !== 'ios'`.

- [ ] **Step 1: Write the failing tests**

```ts
check('dayKey pads a local calendar date', () => {
  eq(dayKey('2026-01-05T15:00:00.000Z').split('-')[1] !== '0', true, 'month is not 0-based');
});
```

Put that in a new `src/datetime.test.ts` using a fixed ISO. Assert the result equals `localDayKey` of the same string.

In `src/medSuppSelection.test.ts`, dispatch `load-selection` with `medQty` containing `99` and assert the stored quantity is `20`. Dispatch `prune` after removing an id and assert that id is gone from `medQty`.

In `src/trendsStats.test.ts`:

```ts
eq(diffLabel(0.04), 'about the same on days taken vs. not taken', 'rounds to zero');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`

Expected: FAIL on the 0-based month, the unclamped quantity, or the missing `diffLabel` assertion.

- [ ] **Step 3: Implement the leftovers**

`dayKey`:

```ts
import { localDayKey } from './trendsStats';
export function dayKey(iso: string): string {
  return localDayKey(iso);
}
```

Clamp in the med/supp reducer on `load-selection` and `prune`:

```ts
function clampQty(n: number): number {
  if (!Number.isInteger(n) || n < 1) return 1;
  if (n > 20) return 20;
  return n;
}
```

`SymptomForm` severity `Pressable`: `accessibilityRole="radio"` and `accessibilityState={{ selected: severity === n }}`.

`TodayEntries` delete label: ``Delete ${KIND_LABEL[log.kind]} ${log.title}``.

`ProSection` free-state sentence: include Trends next to AI Coach and backup, matching `PRO_FEATURES`.

`NotificationSection.apply`: call `saveReminderSettings(next)` before `setSettings(next)`. On throw, `Alert.alert('Could not save reminders', ...)` and return without `setSettings`. `toggleEnabled` builds the next settings from a ref that is updated whenever `settings` changes, so an in-flight permission prompt cannot spread a stale object.

Replace the two `iPhone Settings` strings with `Platform.OS === 'ios' ? 'iPhone Settings' : 'Settings'`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datetime.ts src/datetime.test.ts src/components/log/medSuppSelection.ts src/medSuppSelection.test.ts src/trendsStats.test.ts src/components/log/SymptomForm.tsx src/components/log/TodayEntries.tsx src/components/profile/ProSection.tsx src/components/profile/NotificationSection.tsx
git commit -m "fix: clamp quantities, calendar day keys, and reminder save errors"
```

---

### Task 20: Pin the on-device model and reject advice-shaped narratives

**Files:**
- Modify: `src/llm/model.ts`
- Modify: `src/llm/engine.ts` (`downloadOnDeviceModel`, `isModelReady`)
- Modify: `src/macroCorrelations.ts` (`UNSAFE_NARRATIVE`)
- Modify: `src/macros.test.ts`

**Interfaces:**
- Produces: `export const ON_DEVICE_MODEL_SHA256: string` — the SHA-256 of the pinned GGUF at `ON_DEVICE_MODEL_URL`. `downloadOnDeviceModel` writes to `ON_DEVICE_MODEL_FILE + '.partial'`, hashes the bytes, and moves the file onto `ON_DEVICE_MODEL_FILE` only when the hash matches. A mismatch deletes the partial file and throws `The model download did not match the expected file.` `isModelReady()` is true only when the final file exists and its size equals `ON_DEVICE_MODEL_BYTES`. `acceptNarrative` returns null for text matching `cause`, `causes`, `improve`, `improves`, `worsen`, `worsens`, `avoid`, `cut out`, `don't eat`, `do not eat`, `quit`, or `discontinue`, in addition to the current pattern.

- [ ] **Step 1: Write the failing tests**

In `src/macros.test.ts`, next to the existing `acceptNarrative` checks:

```ts
eq(
  acceptNarrative('In your logs, higher fat days cause headache severity to drop across the month.'),
  null,
  'causal wording',
);
eq(
  acceptNarrative('Averaged across your logs, headache severity was lower on higher-fat days.'),
  'Averaged across your logs, headache severity was lower on higher-fat days.',
  'descriptive wording stays',
);
```

The download hash cannot be unit-tested without the network. Do not add a test that fetches Hugging Face.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL on `causal wording` because `cause` is not in `UNSAFE_NARRATIVE`.

- [ ] **Step 3: Widen the filter and verify the download**

```ts
const UNSAFE_NARRATIVE =
  /\b(you should|stop taking|start taking|increase your|decrease your|diagnos|causes?|improves?|worsens?|avoid|cut out|don't eat|do not eat|quit|discontinue)\b/i;
```

Confirm `causes?` does not reject the safe sentence in Step 1 (`was lower` has no `cause`). If the alternation is too broad, require the causal verbs as whole words only, which the `\b` boundaries already do.

Download, using `expo-file-system` and `expo-crypto` if it is already a dependency. If `expo-crypto` is not installed, hash with `crypto` is not available in the app runtime. Add `expo-crypto` only if the Expo SDK 57 docs show `Crypto.digestStringAsync` cannot hash a file; prefer `Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)` on the file bytes from the SDK 57 `expo-crypto` docs at https://docs.expo.dev/versions/v57.0.0/sdk/crypto/. Compute the expected hash once from the pinned URL (record the command in the commit message) and paste it into `ON_DEVICE_MODEL_SHA256`. Record `ON_DEVICE_MODEL_BYTES` from that same download. Do not commit the GGUF.

```ts
export async function downloadOnDeviceModel(onProgress?: (fraction: number) => void): Promise<void> {
  const dir = modelsDirectory();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const partial = new File(dir, `${ON_DEVICE_MODEL_FILE}.partial`);
  const dest = onDeviceModelFile();
  try {
    await File.downloadFileAsync(ON_DEVICE_MODEL_URL, partial, {
      idempotent: true,
      onProgress: (data) => {
        if (!onProgress || data.totalBytes <= 0) return;
        onProgress(Math.min(1, data.bytesWritten / data.totalBytes));
      },
    });
    if (partial.size !== ON_DEVICE_MODEL_BYTES) {
      throw new Error('The model download did not match the expected file.');
    }
    const hash = await sha256File(partial);
    if (hash !== ON_DEVICE_MODEL_SHA256) {
      throw new Error('The model download did not match the expected file.');
    }
    if (dest.exists) dest.delete();
    partial.move(dest);
    await releaseContext();
  } catch (err) {
    if (partial.exists) partial.delete();
    throw err;
  }
}
```

`sha256File` is a local helper in `engine.ts` using the SDK 57 API confirmed in Step 3's doc read. `isModelReady` returns `onDeviceModelFile().exists && onDeviceModelFile().size === ON_DEVICE_MODEL_BYTES`.

Update `ON_DEVICE_MODEL_MB` to `Math.round(ON_DEVICE_MODEL_BYTES / (1024 * 1024))` so the Profile copy matches the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test` and `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/llm/model.ts src/llm/engine.ts src/macroCorrelations.ts src/macros.test.ts package.json package-lock.json
git commit -m "fix: verify the on-device model hash and reject causal narratives"
```

## Self-review

Spec coverage:

- Orphan backup restore: Task 1
- Canonical timestamps: Task 2
- Backup size: Task 3
- Stable pagination: Task 4
- Streak query count: Task 5
- Year/All and week length: Task 6
- Chart spacing: Task 7
- Symptom case: Task 8
- Food lookalikes: Task 9
- Lion principles: Task 10
- Duration labels: Task 11
- Reminder date key and custom alarms: Task 12
- 30-day export plus weight: Task 13
- Pro fail-closed and Restore: Task 14
- Duplicate saves and segment reset: Task 15
- Destructive copy and reminder reload: Task 16
- Leftover files and stale notification taps: Task 17
- user_version: Task 18
- dayKey, quantity clamp, a11y, settings copy, diffLabel: Task 19
- Model checksum, partial download, narrative advice filter: Task 20

Out of scope on purpose: real StoreKit, screen-level React Navigation tests, and a Profile dirty-form prompt. Profile still reloads on focus and drops unsaved text; that is a product decision, not part of this fix list. `listDailyMacros()` loads every macro row with no day cap; Task 6 should pass the same lookback into that query when it threads range into the other Trends queries.

Placeholder scan: every task names the files, the test, and the implementation. Task 17 Step 1 is a required doc check because the Expo method name must come from SDK 57, not from memory.

Type consistency: `sinceIsoForRange`, `occurrencesToSchedule`, `scheduleKey`, `SymptomSeries`, `beginSave`, and `DELETE_ALL_BODY` / `IMPORT_BODY` are defined in the task that introduces them and used under those names afterward. Pro keeps the existing name `purchaseTestModeEnabled`.

---
