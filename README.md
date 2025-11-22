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

## Local Supabase (optional)

The app can talk to the Supabase stack that lives under `../fragments-supabase`.

1. Boot the backend  
   ```bash
   cd fragments-supabase
   ./supabase-start.sh
   ```
2. Copy `.env.example` → `.env` in this folder and set:
   ```
   EXPO_PUBLIC_SUPABASE_URL=http://localhost:8000    # or http://<your-lan-ip>:8000 for physical devices
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from fragments-supabase/.env or Studio>
   ```
3. Create a table for manual entries (run in Supabase SQL editor):  
   ```sql
   create extension if not exists "uuid-ossp";
   create table if not exists public.foods (
     id uuid primary key default uuid_generate_v4(),
     name text not null,
     quantity text,
     notes text,
     image_url text,
     group_name text not null default 'Solo',
     inserted_at timestamptz default timezone('utc', now())
   );
   alter table public.foods enable row level security;
   create policy "Foods allow all" on public.foods for all using (true) with check (true);

   create table if not exists public.recipes (
     id uuid primary key default uuid_generate_v4(),
     name text not null,
     summary text,
     image_url text,
     prep_time text,
     servings text,
     instructions text,
     inserted_at timestamptz default timezone('utc', now())
   );

   create table if not exists public.nutrition_preferences (
     id uuid primary key default uuid_generate_v4(),
     profile_id text not null,
     metrics text[] default '{}'::text[],
     likes text,
     dislikes text,
     allergies text,
     updated_at timestamptz default timezone('utc', now())
   );

   create table if not exists public.fragments (
     id uuid primary key default uuid_generate_v4(),
     profile_id text not null,
     title text not null,
     description text,
     inserted_at timestamptz default timezone('utc', now())
   );
   ```

The Pantry screen includes a **Quick add to Supabase** card that writes to the `foods` table using the Supabase REST API.

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
