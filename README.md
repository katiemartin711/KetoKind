# KetoKind

A private diet-logging app for keto / carnivore / lion-diet eaters. Log meals,
medications, symptoms, and supplements — then export a Markdown **context file**
plus a ready-made **coach setup prompt** and paste them into the AI chat of your
choice (ChatGPT, Claude, etc.). That AI becomes your personal diet coach.

**No AI runs inside this app.** No API keys, no servers, no accounts. Your health
data stays in an on-device SQLite database until *you* choose to share the export
file. That's the whole privacy model — and why there's nothing to maintain.

## Screens

| Tab | What it does |
|---|---|
| **Dashboard** | Today's date, stat cards (meals, meds taken vs. scheduled, symptoms, supplements), daily logging streak, quick-add buttons |
| **Log** | Segmented forms for Meal / Medication / Symptom / Supplement + today's entries with delete |
| **Profile** | Diet type (Keto / Carnivore / Lion Diet), personal diet nuances, goals, allergies, health conditions, medications — all of this feeds the AI context file |
| **AI Coach** | Preview of the generated Markdown context file (profile + last 30 days), "Copy coach setup prompt" button, "Export & Share" button that writes the `.md` file and opens the share sheet |

## Project structure

```
ketokind/
  App.tsx                  # Bottom-tab navigator (Dashboard / Log / Profile / AI Coach)
  index.ts                 # Expo entry
  src/
    types.ts               # Shared TypeScript types + tab param list
    theme.ts               # Colors, shared styles
    db.ts                  # ALL SQLite access: schema, typed helpers, export queries
    screens/
      DashboardScreen.tsx
      LogScreen.tsx
      ProfileScreen.tsx
      ExportScreen.tsx     # "AI Coach" tab: context file builder + share
```

The database (`ketokind.db`) is created on first launch via `initDb()` in
`src/db.ts`. Tables: `profile` (single row), `allergies`, `conditions`,
`medications`, `food_logs`, `med_logs`, `symptom_logs`, `supplement_logs`.

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
npx tsc --noEmit                  # typecheck without starting the server
```

## Key dependencies (Expo SDK 57)

- `expo-sqlite` — on-device database (synchronous API)
- `expo-file-system/legacy` — writes the `.md` context file
- `expo-sharing` — opens the native share sheet for the file
- `expo-clipboard` — copies the coach setup prompt
- `@react-navigation/native` + `@react-navigation/bottom-tabs` — tab navigation
- `@expo/vector-icons` — tab bar icons

## Notes

- KetoKind is a logging tool, not a medical professional. The app and the
  coach prompt both carry "not medical advice" language, and the prompt
  explicitly tells the AI never to advise on medications.
- Free vs. Pro tiers (free logging → one-time Pro unlock for insights/export)
  are a product decision for later; the scaffold has no paywall yet.
