# KetoKind

A local-first diet-logging app for keto, carnivore, lion-diet, and paleo
eaters. Log meals, medications, supplements, symptoms, and (optionally)
weight — then export a Markdown **context file** plus a ready-made **coach
setup prompt** and paste them into the AI chat of your choice (ChatGPT,
Claude, etc.). That AI becomes your personal diet coach.

Meal macro estimates and the Trends summary run **on this phone** after you
download a small model. That download is the only network request the app
makes, and it does not upload your logs. There is still no account and no
server. The AI Coach tab does not call an API — it builds a file you can
paste into a chat app if you want.

## Screens

| Tab | What it does |
|---|---|
| **Dashboard** | Today's date, stat cards (meals, meds taken vs. scheduled, symptoms, supplements) — tapping a tile opens a full list of that log type — diet-start milestones, daily logging streak, quick-add buttons, optional weight card (tappable too) |
| **Log** | Segmented forms for Meal / Meds & Supps / Symptom / Weight + today's entries (tap to edit, ✕ to delete). Meals can carry estimated or edited macros (protein, fat, total and net carbs, and calories when that setting is on). Symptom names suggest previously logged labels for consistency |
| **Trends** | **Pro:** weight trend graph with range dropdown, medication/supplement × symptom patterns with a "strongest patterns" ranking, a symptom-over-time severity chart, and macro-balance × symptom comparisons with an on-demand on-device summary |
| **Profile** | "About You" (name, age, sex, bio), diet type (Keto / Carnivore / Lion Diet / Paleo) with per-diet principle info panels, diet nuances, goals, diet start date, weight tracking, appearance (theme), allergies, health conditions, medications, supplements, full backup / restore, delete-all |
| **AI Coach** | Coach setup-prompt preview (profile + per-diet guiding principles + last 30 days of logs), "Copy prompt + logs" button, "Share context file only (.md)" button that writes `ketokind-context.md` and opens the share sheet |

## Architecture

### Project structure

```
ketokind/
  App.tsx                        # Stack + tabs (Dashboard / Log / Trends / Profile / AI Coach)
  index.ts                       # Expo entry
  src/
    types.ts                     # Shared TypeScript types + diet types
    theme.ts                     # Light/dark palettes, shared styles, ThemeMode
    ThemeContext.tsx             # App-wide theme (system / light / dark, persisted in profile)
    datetime.ts                  # Shared local date/time formatters
    confirmDelete.ts             # Shared delete-confirm Alert for log entries
    dietPrinciples.ts            # 10 per-diet AI-coach guiding principles (keto base + overrides)
    milestones.ts                # Diet-start parsing + anniversary-milestone logic
    reminderLogic.ts             # Pure reminder schedule math
    reminders.ts                 # Local notification permission + scheduling
    pro.ts                       # Pro entitlement helpers (IAP hook-in points)
    nodeSqliteAdapter.ts         # TEST-ONLY in-memory SQLite (excluded from the app bundle)
    db/
      client.ts                  # Lazy expo-sqlite singleton, closeDatabase(), test hook
      schema.ts                  # CREATE TABLE + versioned migrations (SCHEMA_VERSION 5)
      reset.ts                   # Shared wipe+reinit for recovery screens
      profile.ts                 # Profile row CRUD (single row, id = 1)
      catalog.ts                 # Allergies, conditions, medications, supplements
      logs.ts                    # Food / med / supplement / symptom / weight logs
      trends.ts                  # Bounded Trends queries (Pro-gated callers)
      backup.ts                  # exportBackup / validateBackup / importBackup
      exportData.ts              # AI-coach payload: profile + trailing-30-day summary
    screens/
      DashboardScreen.tsx        # Today view: stats, milestones, streak, quick add
      LogScreen.tsx              # Tab composer: owns state, renders log/* form components
      LogListScreen.tsx          # Paginated all-logs list (Dashboard tile drill-down)
      TrendsScreen.tsx           # Pro: weight graph + symptom patterns
      ProfileScreen.tsx          # Tab composer: owns state, renders profile/* sections
      ExportScreen.tsx           # "AI Coach" tab: prompt preview + copy + share
    components/
      KeyboardScrollView.tsx     # ScrollView that dodges the keyboard
      PaywallModal.tsx           # Pro upsell
      log/                       # Log tab forms + TodayEntries + useLogScreen
      profile/                   # Profile sections (incl. Backup, Notifications, Testing)
      trends/                    # Charts, dropdowns, pattern chips
```

Screens are thin composers: all state, validation, and persistence live in the
screen; the components under `components/log/` and `components/profile/` are
presentational sections that receive props.

### Data flow

UI → `src/db/*` typed helpers → `expo-sqlite` (synchronous API) →
`ketokind.db` on device. The AI coach export reads through `getExportData()`
and builds the prompt from `dietPrinciples(dietType)`; nothing ever leaves the
device except the file the user explicitly copies or shares.

Two `tsconfig`s keep concerns separate: `tsconfig.json` typechecks the app
(excluding tests and the Node SQLite adapter), while `tsconfig.test.json`
compiles only the pure/testable modules (`db`, `types`, `theme`,
`milestones`, `dietPrinciples`, tests, adapter) to `dist-test/` for Node.

### SQLite schema (`ketokind.db`)

Tables: `profile` (single row, `id = 1`), `allergies`, `conditions`,
`medications`, `supplements`, `food_logs`, `med_logs`, `symptom_logs`,
`supplement_logs`, `weight_logs`.

**Migrations** (`SCHEMA_VERSION = 6`, applied in order via
`PRAGMA user_version` + `addColumnIfMissing` / index helpers):

- **v2:** `med_logs.name` snapshot (history survives renames/deletes) +
  `profile.name` for the AI coach greeting.
- **v3:** `profile.is_pro` (local Pro cache; not included in backups).
- **v4:** `profile.reminder_settings` JSON for local log reminders.
- **v5:** indexes on log timestamp columns for day queries, LogList,
  Trends, and streak checks.
- **v6:** optional meal macros (`protein_g`, `fat_g`, `carbs_g`, `fiber_g`,
  `net_carbs_g`, `calories`, `macro_source`), `profile.track_calories`,
  `profile.llm_offer` (declined the model download — not included in backups),
  and a `trend_insights` cache for the on-device Trends summary.

### Backup format

`exportBackup()` snapshots every table into one JSON object
(`ketokind-backup-*.json`), `version: 1`. Pro entitlement (`is_pro`) is
**not** included — restore purchases through the App Store / Play Store after
switching devices. `validateBackup()` is pure and runs
*before* any data is touched: it checks structure, duplicate ids, ISO-8601
timestamps, numeric ranges, and cross-list references (e.g. every
`medLogs[].medication_id` must exist in `medications`). `importBackup()`
refuses invalid files before deleting anything and restores inside a single
transaction — a mid-import failure rolls everything back. Import preserves
this device's Pro flag (never grants Pro from a file). Pre-v2 backups
(without med-log name snapshots) still import; names are backfilled from the
restored medications. Delete-all also resets `theme_mode` to `system` and
clears the profile name.

## Run it

Prerequisites: Node 18+. Logging works in the **Expo Go** app. The on-device
model needs a custom build (Expo dev client): `npx expo run:ios` or
`npx expo run:android`. Expo Go can still save meals; it just cannot download
or run the model.

```bash
npm install
npx expo start --tunnel
```

Then scan the QR code with Expo Go (iOS: Camera app; Android: inside Expo Go).
The `--tunnel` flag makes the dev server reachable from your phone even on a
different network.

Useful extras:

```bash
npx expo start --tunnel --clear   # clear the Metro bundler cache if something looks stale
npx tsc --noEmit                  # typecheck the app (excludes tests)
```

## KetoKind Pro

**Free forever:** all logging (meals, medications, supplements, symptoms,
weight), on-device macro estimates, the dashboard, streaks, and milestones.

**Pro — $9.99 one-time:** the AI Coach context export (copy prompt + logs, or
share the `.md` file), the Trends tab (weight graph, log patterns, and
macro × symptom correlations with an on-device written summary), and backup
export/import.

Free users see a Pro upsell instead of the AI Coach export UI and the Trends
charts, and tapping the backup buttons opens the paywall. A "KetoKind Pro" row on the Profile tab shows
the current status (Free / Pro ✓). Entitlement is stored as `is_pro` on the
profile row (schema v3); delete-all-data resets it. Backups never carry
`is_pro` — after a phone switch, use Restore Purchases (or the Testing
toggle in `__DEV__`) rather than expecting a backup file to unlock Pro.

**Test mode:** real Apple in-app purchases can't run in Expo Go — they need a
paid Apple Developer account, App Store Connect products, and a development
build. So the paywall's Upgrade and Restore buttons *simulate* success for now
(the paywall is clearly labeled "TEST MODE — no real charge"). The Testing
section at the bottom of the Profile tab has a "Simulate Pro user" switch that
flips the Pro flag instantly, so the app can be previewed as both a free and a
paid user. The IAP hook-in points are marked with `★★★ IAP HOOK-IN POINT ★★★`
in `src/pro.ts` (`requestPurchase()` / `restorePurchase()`).

## Trends (Pro)

The Trends tab has two parts:

- **Weight trend** — a line graph of weigh-ins with a range dropdown (Week /
  Month / 90 days / 6 months / Year / All), marking the low, high, and
  current values plus the change across the range. Dots are drawn only at 30
  points or fewer — past that the line carries it. If weight isn't tracked, a
  friendly empty state explains that weight logging is optional and points to
  the Log tab.
- **Symptom patterns** — pick a symptom and a medication/supplement to compare
  average symptom severity on days the item was taken vs. days it wasn't, plus
  a "strongest patterns" list ranking the top 3 symptom × item pairs by
  absolute difference.
- **Symptom over time** — pick a symptom to see its severity (1–5) plotted day
  by day over the same range options, with days logged, average, and worst
  severity.

**When a comparison shows:** each side needs at least 2 days and at least one
side needs 7+, counted on days the symptom was logged — so a very regular
taker still gets a comparison from just a few missed days. Below that the UI
says "not enough data yet" and shows the day counts so far — thin data is
withheld, not charted. All bucketing is by local day.

**Patterns, not advice:** every comparison is framed as "patterns in your
logs" — never causal ("X causes/improves Y") and never suggesting starting,
stopping, or changing anything. The tab carries the disclaimer: *"Patterns,
not medical advice. Talk to your doctor about any medication changes."*

**Macro balance (Pro):** days are split at the median of protein, fat, or net
carbs (and calories, only if calorie tracking is on in Profile). Average
symptom severity is compared with the same day floors as other patterns.
A **Write a summary** button runs the on-device model once and caches the
text until the comparisons change. Estimates are labeled approximate.

The model file (about 500 MB, Qwen2.5 0.5B Instruct Q4) downloads the first
time you save a meal, or later from Profile → On-device meal estimates.
Declining the prompt still saves the meal. You can type macros yourself and
skip the model. Net carbs are total carbs minus fiber, computed in the app.

The stats math lives in pure, well-tested `src/trendsStats.ts`; the queries in
`src/db/trends.ts` are only called after the Pro check passes, so free users
never trigger data loading for this tab.

## Sample data

Don't want to log for 90 days before seeing what Trends can do? Two synthetic
datasets live in [`sample-data/`](sample-data/) — no real user data, and both
pass the app's real backup validator:

| File | What's inside | Best for |
|---|---|---|
| `ketokind-trends-sample-data.json` | 90 days: weight 152.4 → 143.3 lb, 320 symptom logs, 60 med logs, 174 supplement logs, 28 meals | The Trends tab: weight graph, symptom × item patterns, symptom-over-time chart |
| `ketokind-sample-data.json` | ~2 weeks of everyday logging: 34 meals, meds, supplements, symptoms, weigh-ins | Touring the Dashboard, Log tab, and AI Coach export |

The trends dataset is built to show the feature off: Congestion × Cetirizine,
Headache × Magnesium Glycinate, and Muscle cramps × Electrolyte mix all have
enough data to produce comparisons, while Vitamin D3 (logged every day, so
there's no "not taken" side) and Melatonin (logged once) demonstrate the "not
enough data yet" states. It imports as a **free** profile, so you can also try
the Pro paywall from the Trends tab.

**To import one:**

1. Get the `.json` file onto your phone (download it from this repo, then
   AirDrop / email it to yourself / save it to Files).
2. Open KetoKind in Expo Go. Import is a Pro feature, so first go to the
   **Profile** tab → **Testing** section and turn on **Simulate Pro user**.
3. Profile → **Backup** → **Import data**, pick the file, and confirm.
   Importing **replaces everything** currently on the device — export your own
   data first if you want to keep it.
4. Head to the **Trends** tab.

## Testing

Tests run the real `src/db/*` code against an in-memory SQLite
(`node:sqlite`) via an injectable database handle — export, import, and
migrations are genuinely exercised, with no phone or emulator needed.

```bash
npm test   # tsc -p tsconfig.test.json, then node dist-test/*.test.js
```

| Suite | Covers | Current |
|---|---|---|
| `src/milestones.test.ts` | Diet-start parsing/formatting, duration labels, milestone detection, dismissed-milestone persistence | 14 passed |
| `src/backup.test.ts` | Backup round-trip, malformed rejection, rollback, migrations, Pro omitted from export / preserved on import, timestamp indexes, meal-macro round-trip | 42 passed |
| `src/dietPrinciples.test.ts` | Every diet returns 10 non-empty principles; per-diet overrides never contradict the diet (e.g. no "dairy is optional" for Lion Diet or paleo); keto and carnivore are differentiated | 7 passed |
| `src/numberParsing.test.ts` | Strict int/float parsers accept plain numbers and reject junk like "12abc", "1e3", "0x10" | 4 passed |
| `src/medSuppSelection.test.ts` | Log-tab med/supp selection state machine: multi-select, qty init/drop, edit-mode single-select locking of the other section, qty clamping 1–20, prune, load, reset | 10 passed |
| `src/profileValidation.test.ts` | Profile save validation: age 1–120, diet-start month+year required, month/year/day ranges, leap days, future dates rejected | 7 passed |
| `src/medSuppForm.test.tsx` | MedSuppForm component (via @testing-library/react-native under plain node): chips render, save disabled until selection, tap callbacks, edit-mode section locking, as-needed qty stepper | 9 passed |
| `src/pro.test.ts` | Pro flag persistence round-trip, v3 migration (adds `is_pro` default 0 to pre-v3 profiles, preserves an already-set flag, keeps profile data), delete-all resets Pro, simulated purchase/restore helpers | 8 passed |
| `src/trendsStats.test.ts` | Trends stats: local-day bucketing, averaging, pattern-day thresholds (≥2 days per side, 7+ on one side) withholding thin comparisons, the regular-taker case, top-3 pattern ranking, weight/symptom range filtering and summaries, plus the db query helpers (weight series order, per-day symptom averaging, case-insensitive item-day grouping) | 17 passed |
| `src/logs.test.ts` | `getLogsOfKind` ordering/normalization/pagination, `deleteLog`, streak day-walking, distinct prior symptom names | 7 passed |
| `src/reminderLogic.test.ts` | Reminder occurrence math (daily nudge, only-if-no-logs, custom times) | 12 passed |
| `src/foodGroups.test.ts` | Food-group expansion for Trends food × symptom matching | 12 passed |
| `src/symptomSuggestions.test.ts` | Symptom name suggestion filter (substring, exact-match hide, limit) | 5 passed |
| `src/symptomForm.test.tsx` | SymptomForm prior-name chips: show/filter/tap-to-fill | 5 passed |
| `src/macros.test.ts` | Macro JSON parsing, user edits, meal-save download plan, macro × symptom median splits, narrative safety filter | 7 passed |

`npm test` auto-discovers `*.test.js` under `dist-test/` via `test/run.js`. The app typecheck (`npx tsc --noEmit`) is clean. CI (`.github/workflows/ci.yml`) runs `npm test` and the typecheck on every push to `main` and every pull request.

## Screenshots

Release assets (captured on iPhone via Expo Go, light and dark mode):

1. Branded splash — green K emblem + KetoKind wordmark
2. Dashboard — milestones, stat cards, quick add, weight card
3. Log tab — meal entry form
4. Profile tab — diet type with per-diet principles panel expanded
5. AI Coach tab — coach prompt preview with guiding principles
6. Dark-mode screen
7. Screen recording (30–60s): launch → splash → log a meal → dashboard → AI Coach copy

## Key dependencies (Expo SDK 57)

- `expo-sqlite` — on-device database (synchronous API)
- `expo-file-system` — writes the `.md` context file and backups (v2 `File`/`Directory` API)
- `expo-sharing` — opens the native share sheet for the file
- `expo-clipboard` — copies the coach setup prompt
- `@expo/ui` — native date/time picker (color scheme follows the app theme)
- `@react-navigation/native` + `@react-navigation/bottom-tabs` — tab navigation
- `@expo/vector-icons` — tab bar icons

## Notes

- KetoKind is a logging tool, not a medical professional. The app and the
  coach prompt both carry "not medical advice" language, and the prompt
  explicitly tells the AI never to advise starting, stopping, or changing
  medication.
- Free vs. Pro tiers (free logging → one-time Pro unlock) ship with a
  paywall UI; real StoreKit / Play Billing still needs to be wired before
  release builds (see `src/pro.ts`).
- KetoKind is proprietary software. Copyright (c) 2026 Katie Martin. All
  rights reserved — see `LICENSE`.
