Write Up:
This app has been stuck in my head for a long time. I first thought of it while pacing around my living room, wondering why cooking feels so hard when you are busy, or tired, or just trying to get through school. I sketched ideas, then made a simple prototype, then another, and then another after that. I have rebuilt this so many times I stopped counting. Every version taught me something, even the bad ones.

I began with FlutterFlow because at the time I did not trust myself to write everything from scratch. But once the idea got bigger, the tool started fighting me. So I moved to React, and then played around with plain JavaScript, and finally landed in React Native. I realized I needed control, not shortcuts.

My brain moves fast. I think of a lot of ideas at once and bounce between them constantly. Working that way used to feel like a weakness. Then this class helped me understand how to use AI as part of the process. I became better at taking the chaos in my head and turning it into something organized. I learned how to ask clearer questions, explain what I want, and use ChatGPT as a thinking partner. It helped me break problems down instead of getting stuck in them.

When Codex became integrated into VS Code, the entire process shifted again. It could finally see all of my files at once. I could ask it to edit something and then see the change appear live in the iPhone simulator. It made progress feel real instead of abstract.

The name did not come quickly. For a long time I tried different names like MealMate and Foodie. Eventually I realized this project is really about information. My early experiments with AI-generated recipes showed me that the more context I gave the AI, the better the results got. It needed to know what ingredients I had, what I liked, what I disliked, what equipment I owned, what was affordable that week, and even how busy I was. That is when the name Fragments finally made sense.

Fragments is about collecting all the small pieces that make cooking easier. What someone has in their fridge, how much money they want to spend, what tools they own, what flavors they enjoy, what they refuse to eat, what goes on sale at their store, which foods they buy the most, what they want to avoid, and the meals that actually work for them. One piece of information by itself does nothing. But many pieces together can change everything.

That is also why the app is meant to work with groups. If three people share their information and scan their groceries, suddenly the work becomes easier for everyone. It becomes cheaper to eat well. It becomes easier to plan. No one has to be the person organizing everything, because the system has the information instead.

Most food apps just give you recipes. Fragments is meant to learn your situation and help you based on that. The more you share with it, the more useful it becomes.

This is the first version that feels like the real beginning instead of another reset. I finally feel like I am building the version that deserves to exist. And after everything I learned this semester, I genuinely believe I can see it through.



# Fragments

Fragments is an Expo + React Native app for food planning, pantry management, and lightweight group collaboration.  
The current build uses a local self‑hosted Supabase stack (auth + Postgres + APIs) as its primary backend.

## Tech stack

- Expo / React Native
- React Navigation (stack + bottom tabs)
- Supabase (auth + Postgres + REST/Realtime)
- `@supabase/supabase-js` with AsyncStorage session persistence
- Dark theme UI with animated “growing card” transitions

## Running the app locally

From the repo root:

```bash
cd FragmentsV
npm install
```

1. **Start the local Supabase stack**

```bash
cd ../fragments-supabase
chmod +x supabase-start.sh supabase-stop.sh   # first time only
./supabase-start.sh
```

See `fragments-supabase/README.md` for ports, dashboard URLs, and troubleshooting.

2. **Configure environment variables for the app**

The mobile app reads Supabase settings from `FragmentsV/.env` via Expo’s `EXPO_PUBLIC_*` mechanism:

```env
EXPO_PUBLIC_SUPABASE_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from fragments-supabase/.env or Supabase Studio>
```

Adjust these values if you change the local Supabase URL or keys.

3. **Run the app**

From `FragmentsV/`:

```bash
npm run start        # start Metro + Expo
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run test         # Vitest unit tests (where present)
```

## App structure

```text
FragmentsV/
  App.tsx                # App bootstrap, theme, NavigationContainer
  app.config.ts          # Expo config
  .env                   # EXPO_PUBLIC_SUPABASE_* env vars
  app/
    components/          # Shared UI pieces (FoodEntryModal, cards, etc.)
    lib/                 # Supabase client
    navigation/          # Root navigator, tabs, Groups stack
    providers/           # AuthProvider (Supabase auth session wiring)
    screens/             # Calendar, Pantry, Groups, GroupDetail, AI Chat, Map, Profile, Auth
    types/               # Domain types (foods, groups, etc.)
    supabaseClient.ts    # (root alias for app/lib/supabaseClient)
```

## Major flows

- **Authentication**
  - Supabase email/password auth using `supabase.auth`.
  - `LoginScreen` and `SignupScreen` gate the app via `AuthProvider` and `AppNavigator`.
  - Sessions are persisted with AsyncStorage; logout is exposed on the **User profile** screen.

- **Home / Calendar**
  - Default landing screen after sign‑in.
  - Range selector: `1d`, `5d`, `7d`, `14d`, `Month`.
  - 1‑day view shows:
    - “Today’s Eating” – total calories, basic macros, and today’s meals with time + calories.
    - “Today’s Tasks” – a simple checklist of meal/prep/cleaning tasks.
  - Multi‑day ranges show scrollable day cards with per‑day summaries and compact meal/task lists.
  - Month view renders a calendar grid; days with content are dotted, and tapping a day shows that day’s meals/tasks.  
  - Currently powered by structured mock data, ready to be swapped to real Supabase data.

- **Pantry**
  - Top‑of‑screen group selector:
    - Options are loaded from the Supabase `groups` table.
    - Changing the selection filters foods by `group_name`.
  - **Foods tab**
    - Grid of food cards showing:
      - Image/thumbnail.
      - Food name.
      - Location · group (e.g. `Fridge · Solo`).
      - Best‑by info (“Best by …” or “No best by date”).
    - Tap a card to open a smooth “growing card” overlay:
      - The image and title animate from the small card into a larger detail card.
      - Header shows name, location/group, and a fading best‑by preview.
      - Meta row: best‑by, cost, barcode.
      - Stored details: quantity + notes.
      - Actions row: **Edit**, **Move to…** (stub), **Add to plan** (stub).
      - “Servings & nutrition” grid driven by `food_servings` for the selected food.
    - Delete icon on the small card removes the item from the `foods` table.
  - **Manual food entry modal**
    - Serving‑based entry form with four stacked sections:
      1. Basic info – name (required), best‑by date, location, barcode (+ placeholder scan button), cost.
      2. Servings row – at least one serving (label, amount, unit) with `+ Add serving` and delete for extras.
      3. Nutrient grid – rows for Energy, Protein, Carbs, Fat, Sat fat, Trans fat, Fiber, Sugar, Sodium; columns follow the serving definitions and each cell is a numeric input (mini spreadsheet feel).
      4. Actions – “Add” / “Save” (primary) and “Close” (secondary).
    - On submit:
      - Inserts/updates the base food row in `foods`.
      - Upserts all serving rows into `food_servings` for that food.
      - On success, closes the modal and refreshes the Pantry list so new data appears immediately.
    - “Edit” in the detail card uses the same modal pre‑filled with existing food + servings.
  - **Recipes tab**
    - Grid of recipe cards (image, name, timing/servings).
    - Tap to open an animated detail card overlay similar to the food overlay, with summary and prep info.  
    - Backed by the Supabase `recipes` table.

- **Groups**
  - **Groups tab / GroupsScreen**
    - Shows the current user’s groups; when present, the Solo group appears first.
    - Each group card shows:
      - Name and role badge (`Owner` or `Member`).
      - Optional description.
      - Simple stats line (members • recipes • inventory items).
      - Optional “Last activity” text.
    - “Create Group” button:
      - Opens a modal to enter name + optional description.
      - Generates a code like `FRAG-ABCD`.
      - Inserts into the `groups` table with `owner_id` = current user.
    - “Join Group” button:
      - Opens a modal with a “Group Code” field.
      - Looks up `groups.invite_code`; if found, inserts a row into `group_members` (role `Member`) and appends the group to the list.
  - **GroupDetailScreen**
    - Reached via the Groups stack with `groupId` (and optional group object) in route params.
    - Layout:
      - Header: group name, role label, simple metadata (members/recipes/inventory counts – currently mock).
      - Inline tab bar for group sections:
        - Overview, Recipes, Inventory, Members, Settings, Chat.
      - Content area below tabs which swaps per active tab:
        - Overview – basic description and summary stats.
        - Recipes – list of group recipes (currently mock UI).
        - Inventory – two sections (“Group inventory” and “Shared from Solo”) with item lists and a stub “Manage inventory” button.
        - Members – list of members with role tags; owner sees placeholder actions (“Remove member”, “Transfer ownership”).
        - Settings – group name/code, copy button (stub), “Leave group”, and “Delete group” (owner only; stubs for now).
        - Chat – dedicated tab with a scrollable in‑memory message list and input row; this is where AI/system messages will later appear.

- **User profile**
  - Accessed via the circular profile icon in the top‑left of the main tabs.
  - Internal segmented control: **Settings** and **Fragments**.
    - Settings section:
      - “Nutrition preferences” dropdown:
        - Checkbox list of metrics (Calories, Protein, Carbs, Fat, Fiber, Sodium, Potassium, Sugar).
        - Selections are stored in `nutrition_preferences.metrics`.
      - Text inputs for Likes, Dislikes, Allergies.
      - Data is upserted into `nutrition_preferences` keyed by `profile_id` (Supabase auth user id).
    - Fragments section:
      - Displays the user’s saved fragments from the `fragments` table (title + optional description).
      - “Create new fragment” inserts a placeholder row via Supabase and prepends it to the list.
  - Logout button calls `supabase.auth.signOut()`; the current email is displayed underneath when available.

- **Tabs & AI**
  - Bottom tab bar:
    - `Calendar` • `Pantry` • **center `AI` tab** • `Groups` • `Map`.
  - AI tab:
    - Uses a custom fragments‑style icon whose pieces “snap together” when focused.
    - Currently hosts `AiChatScreen` with placeholder content, ready for future AI‑driven group/pantry helpers.
  - Map tab:
    - `MapScreen` placeholder for future location‑aware features (e.g., nearby stores or shared pantries).

## Supabase data (high‑level)

- Authentication: standard Supabase auth users (email/password) managed via Supabase Studio or the in‑app auth screens.
- Core tables currently used by the app:
  - `foods` – pantry items, including group, location, best‑by, cost, and metadata.
  - `food_servings` – serving definitions + per‑serving nutrient values for foods.
  - `recipes` – recipes displayed in the Pantry Recipes tab and group contexts.
  - `groups` – collaborative groups, including Solo and shared groups.
  - `group_members` – user/group membership and role (Owner/Member).
  - `nutrition_preferences` – per‑user metric selections and likes/dislikes/allergies.
  - `fragments` – user‑saved “fragment” entities surfaced on the profile screen.

Full schema and policies live in your Supabase project. Use Supabase Studio to inspect and evolve the schema; keep the app’s queries/types in `app/` aligned with any changes.

## Testing

Vitest is configured; where tests exist you can run:

```bash
npm run test
```

Most current work is UI‑ and integration‑focused, so tests are light and can be expanded as the data model stabilizes.

