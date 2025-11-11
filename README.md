# Fragments

Fragments is an Expo + React Native starter that focuses on pantry management, fragments of content, and lightweight collaboration. It is built around an on-device SQLite database with a thin repository layer, NativeWind styling, Zustand stores, and stubs for barcode scanning/image picking so it can expand toward richer features later.

## Getting Started

```bash
npm install
npm run start        # start Metro + Expo
npm run ios          # build and run the iOS app
npm run android      # build and run the Android app
npm run test         # run Vitest unit tests
```

### Seeds & Flags

- Local data lives in SQLite (`fragments.db`). Migrations run on the first launch and seed data is inserted once. Use the in-app **Debug** screen to re-seed or clear tables.
- Configuration lives in `app.config.ts`. Feature flags load via `app/utils/flags.ts`, exposing `useLocalDB` and `devUserId`.

## Structure

```
app/
  components/        # Shared UI pieces (cards, toolbar, badges, empty states)
  db/                # SQLite bootstrap, migrations, seed helpers
  features/          # Scanning + image stubs
  models/            # Zod schemas + shared types
  navigation/        # Tab + stack navigators
  repos/             # Thin async repositories (fragments, inventory, groups, prefs)
  screens/           # Calendar, Pantry (list/detail/edit), Groups, Settings, Debug
  stores/            # Zustand stores per domain
  utils/             # Units, formatting, flags, logger, id helpers
App.tsx              # App bootstrap, NavigationContainer, dev banner
tailwind.config.js   # NativeWind/Tailwind theme
vitest.config.ts     # Unit test config (repos + utilities)
```

## Current Capabilities

- Local SQLite storage with a seeded pantry fragment, user prefs, and offer to reseed/clear from the in-app Debug screen.
- Bottom tab navigation between Calendar, Pantry, Groups, and Settings flows plus a stacked Pantry experience (list → detail → edit → debug).
- Pantry tracking primitives (list, quick add, edit, delete) with state/memoization handled through Zustand stores and quantity badges.
- Stubbed barcode scanning and image choosing so new inventory entries can capture metadata without blocking the UI.
- Nutrition/preferences management (likes, dislikes, allergies, metric toggles, share toggle) persisted to SQLite and surfaced on the Settings screen.
- Group creation/joining plumbing with memberships, and a dev banner that surfaces the current `devUserId` against the local DB flag.

## Testing

Light unit tests cover the inventory repository hybrid identity logic and the unit conversion helpers. Run them with `npm run test`. Tests mock the SQLite layer so they are fast and deterministic.

## Notes

- The Debug screen lets you inspect row counts, reseed/clear the DB, and read recent log entries (last 100 console logs).
- Pantry edit forms use React Hook Form + Zod. Quick add is intentionally simple for week-one velocity.
- Feature flags + `devUserId` are surfaced across stores/screens so a future Supabase/Auth layer can reuse the plumbing.
