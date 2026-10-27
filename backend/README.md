# Silo backend (Supabase)

The database for Silo lives here. Supabase gives us the Postgres database, sign-up/sign-in, and an API, so there's no separate server to run.

```
backend/
└── supabase/
    ├── migrations/
    │   └── 20261027000000_init_schema.sql   ← tables, security rules, dashboard views
    └── seed.sql                              ← sample data (same names as demo mode)
```

## What's in the database

| Table / view | Used by |
|---|---|
| `profiles` | Signed-in users. Filled automatically from the sign-up form (first name, last name, organization). |
| `farmers` | Farmers page. New farmers start as `pending` for review. |
| `volunteers` | Volunteers page. Assigned to pickups. |
| `recipients` | Recipients page (food banks, kitchens, pantries). |
| `donations` | Donations page and the "Donation activity" table. |
| `pickups` | Pickups page and "Pickups today". |
| `activity_log` | "Undo last action" card. |
| `dashboard_stats` (view) | The four stat cards + priority queue counts. |
| `donation_activity` (view) | Donation + farm + recipient names in one row for the activity table. |
| `rescue_volume_daily` (view) | The "Rescue volume" chart. |

**Who can do what**

- Anyone signed in can **view** data.
- `coordinator` and `admin` can **add, edit, and delete**. New sign-ups are coordinators.
- `volunteer` can only view.
- Users can't change their own role. Change roles in the Supabase dashboard (see step 4).

## Setup

### 1. Create the project
Go to [supabase.com](https://supabase.com), create a new project, and wait for it to finish setting up.

### 2. Create the tables
1. Open **SQL Editor** → **New query**.
2. Paste everything from `supabase/migrations/20261027000000_init_schema.sql` and click **Run**.
3. (Optional) Make a new query, paste `supabase/seed.sql`, and run it to load sample data.

### 3. Get your keys
Open **Project Settings → API Keys** (or the **Connect** button at the top) and copy:
- **Project URL**
- **Publishable key** (or the legacy **anon public** key — either works)

Put them in a file called `OLIS/.env` (create it next to `package.json`):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

These two are safe to use in the browser because the security rules protect the data. **Never** put the `service_role` / secret key in the frontend or on GitHub. Make sure `.env` is in `.gitignore`.

### 4. Make yourself admin (after you sign up once)
In **SQL Editor**:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

### 5. Connect the frontend
In the `OLIS` folder:

```bash
pnpm add @supabase/supabase-js
```

Create `OLIS/src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

Examples:

```ts
// Sign up — the extra fields go into the profiles table automatically
await supabase.auth.signUp({
  email,
  password,
  options: { data: { first_name, last_name, organization } },
})

// Sign in
await supabase.auth.signInWithPassword({ email, password })

// Dashboard stat cards
const { data: stats } = await supabase.from('dashboard_stats').select('*').single()

// Donation activity table
const { data: activity } = await supabase.from('donation_activity').select('*').limit(10)

// Log a donation
await supabase.from('donations').insert({ produce: 'Mangoes', quantity_kg: 12, farmer_id })
```

## Using the Supabase CLI instead (optional)
If you prefer the command line over pasting SQL:

```bash
cd backend
npx supabase init          # creates supabase/config.toml, keeps the existing migrations
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase db push       # runs the migration on your project
```

New changes to the database go in new files under `supabase/migrations/` (for example `20261101000000_add_photos.sql`) so everyone in the group gets them.
