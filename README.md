# KetoKind

A local-first diet-logging app for keto, carnivore, lion-diet, and paleo
eaters. Log meals, medications, supplements, symptoms, and (optionally)
weight — then export a Markdown **context file** plus a ready-made **coach
setup prompt** and paste them into the AI chat of your choice (ChatGPT,
Claude, etc.). That AI becomes your personal diet coach.

**No AI runs inside this app.** No API keys, no servers, no accounts. Your
health data stays in an on-device SQLite database until *you* choose to share
the export file. That's the whole privacy model — and why there's nothing to
maintain.

## Screens

| Tab | What it does |
|---|---|
| **Dashboard** | Today's date, stat cards (meals, meds taken vs. scheduled, symptoms, supplements), diet-start milestones, daily logging streak, quick-add buttons, optional weight card |
| **Log** | Segmented forms for Meal / Meds & Supps / Symptom / Weight + today's entries (tap to edit, ✕ to delete) |
| **Profile** | "About You" (name, age, sex, bio), diet type (Keto / Carnivore / Lion Diet / Paleo) with per-diet principle info panels, diet nuances, goals, diet start date, weight tracking, appearance (theme), allergies, health conditions, medications, supplements, full backup / restore, delete-all |
| **AI Coach** | Coach setup-prompt preview (profile + per-diet guiding principles + last 30 days of logs), "Copy prompt + logs" button, "Share context file only (.md)" button that writes `ketokind-context.md` and opens the share sheet |

## Architecture

### Project structure

```
ketokind/
  App.tsx                        # Bottom-tab navigator (Dashboard / Log / Profile / AI Coach)
  index.ts                       # Expo entry
  src/
    types.ts                     # Shared TypeScript types + diet types
    theme.ts                     # Light/dark palettes, shared styles, ThemeMode
    ThemeContext.tsx             # App-wide theme (system / light / dark, persisted in profile)
    dietPrinciples.ts            # 10 per-diet AI-coach guiding principles (keto base + overrides)
    milestones.ts                # Diet-start parsing + anniversary-milestone logic
    nodeSqliteAdapter.ts         # TEST-ONLY in-memory SQLite (excluded from the app bundle)
    db.ts                        # Thin barrel: re-exports everything under db/
    db/
      client.ts                  # Lazy expo-sqlite singleton, closeDatabase(), test hook
      schema.ts                  # CREATE TABLE + versioned migrations (SCHEMA_VERSION 2)
      profile.ts                 # Profile row CRUD (single row, id = 1)
      catalog.ts                 # Allergies, conditions, medications, supplements
      logs.ts                    # Food / med / supplement / symptom / weight logs
      backup.ts                  # exportBackup / validateBackup / importBackup
      exportData.ts              # AI-coach payload: profile + trailing-30-day summary
    screens/
      DashboardScreen.tsx        # Today view: stats, milestones, streak, quick add
      LogScreen.tsx              # Tab composer: owns state, renders log/* form components
      ProfileScreen.tsx          # Tab composer: owns state, renders profile/* sections
      ExportScreen.tsx           # "AI Coach" tab: prompt preview + copy + share
    components/
      KeyboardScrollView.tsx     # ScrollView that dodges the keyboard
      log/                       # Log tab: DateTimeField, MealForm, MedSuppForm,
                                 #   SymptomForm, WeightForm, QtyRow, TodayEntries
      profile/                   # Profile tab: AboutSection, DietSection, WeightSection,
                                 #   AppearanceSection, SimpleListSection, MedSuppSection,
                                 #   BackupSection, DangerSection, ListRow
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

**v2 migration** (`SCHEMA_VERSION = 2`, applied idempotently via
`PRAGMA user_version` + `addColumnIfMissing`):

- `med_logs.name` — a snapshot of the medication's name taken when the dose
  is logged, so history survives medication renames and deletes (orphaned
  rows display as "Deleted medication"). Written by `addMedLog` /
  `updateMedLog`; backfilled from `medications` for pre-v2 rows.
- `profile.name` — "What should your coach call you?"; feeds the AI-coach
  greeting and is cleared by delete-all.

### Backup format

`exportBackup()` snapshots every table into one JSON object
(`ketokind-backup-*.json`), `version: 1`. `validateBackup()` is pure and runs
*before* any data is touched: it checks structure, duplicate ids, ISO-8601
timestamps, numeric ranges, and cross-list references (e.g. every
`medLogs[].medication_id` must exist in `medications`). `importBackup()`
refuses invalid files before deleting anything and restores inside a single
transaction — a mid-import failure rolls everything back. Pre-v2 backups
(without med-log name snapshots) still import; names are backfilled from the
restored medications. Delete-all also resets `theme_mode` to `system` and
clears the profile name.

## Run it

Prerequisites: Node 18+, and the **Expo Go** app on your phone.

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
| `src/backup.test.ts` | Backup round-trip (export → wipe → import restores identical data), malformed-backup rejection, import validates-before-delete, mid-transaction rollback, v2 migration + med-name snapshots, legacy pre-v2 import backfill, delete-all resets theme + name | 38 passed |
| `src/dietPrinciples.test.ts` | Every diet returns 10 non-empty principles; per-diet overrides never contradict the diet (e.g. no "dairy is optional" for Lion Diet or paleo); keto and carnivore are differentiated | 7 passed |
| `src/numberParsing.test.ts` | Strict int/float parsers accept plain numbers and reject junk like "12abc", "1e3", "0x10" | 4 passed |
| `src/medSuppSelection.test.ts` | Log-tab med/supp selection state machine: multi-select, qty init/drop, edit-mode single-select locking of the other section, qty clamping 1–20, prune, load, reset | 10 passed |
| `src/profileValidation.test.ts` | Profile save validation: age 1–120, diet-start month+year required, month/year/day ranges, leap days, future dates rejected | 7 passed |
| `src/medSuppForm.test.tsx` | MedSuppForm component (via @testing-library/react-native under plain node): chips render, save disabled until selection, tap callbacks, edit-mode section locking, as-needed qty stepper | 9 passed |

**89 passed, 0 failed.** The app typecheck (`npx tsc --noEmit`) is clean. CI (`.github/workflows/ci.yml`) runs `npm test` and the typecheck on every push to `main` and every pull request.

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
- `expo-file-system/legacy` — writes the `.md` context file and backups
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
- Free vs. Pro tiers (free logging → one-time Pro unlock) are a product
  decision for later; the app has no paywall yet.
- KetoKind is proprietary software. Copyright (c) 2026 Katie Martin. All
  rights reserved — see `LICENSE`.
