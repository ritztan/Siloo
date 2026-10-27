# Silo backend (Python + Supabase)

```
Website (OLIS)  ──►  Python API (FastAPI)  ──►  Supabase (database + logins)
```

- **Supabase** stores the data and handles accounts.
- **The Python API** (this folder) is what the website calls: sign up, log in, dashboards, donations, pickups, etc.
- Every request runs **as the signed-in user**, so the security rules in the database decide what they can see and change. The backend never uses the secret `service_role` key.

## Who can do what

| Account | How it's created | What they can do |
|---|---|---|
| **Farmer** | Signs up on the website ("Create farmer account") | Starts as **pending**. Once a coordinator approves them: post surplus harvest, see where their donations go. Sees only their own farm. |
| **Coordinator** | Created by you in Supabase (no public sign-up, see below) | Sees everything, approves/suspends farmers, manages donations, pickups, volunteers, recipients. |
| **Admin** | Same as coordinator, plus can change other people's roles | |
| **Volunteer** | Created in Supabase like a coordinator | View only (uses the coordinator login). |

```
backend/
├── app/
│   ├── main.py            ← starts the API
│   ├── config.py          ← reads .env
│   ├── db.py              ← Supabase connection + error handling
│   ├── activity.py        ← remembers each change so it can be undone
│   ├── schemas.py         ← what each request must contain
│   └── routers/
│       ├── auth.py        ← /auth/signup, /auth/signin, /auth/me ...
│       ├── farmer.py      ← /farmer/... (the farmer's own dashboard and donations)
│       ├── dashboard.py   ← /dashboard (coordinator dashboard)
│       ├── reports.py     ← /reports (Reports page)
│       ├── history.py     ← /sidebar, /activity/undo (Undo last action)
│       ├── resources.py   ← /farmers, /volunteers, /recipients, /donations, /pickups
│       └── crud.py        ← shared list/get/create/update/delete logic
├── supabase/
│   ├── migrations/
│   │   ├── 20261027000000_init_schema.sql      ← tables, security rules, views
│   │   ├── 20261027100000_farmer_accounts.sql  ← farmer sign-up + farmer-only rules
│   │   └── 20261027200000_volunteer_recipient_details.sql  ← vehicle, service area, capacity, needs
│   ├── move_old_tables.sql   ← only if the project already had older Silo tables
│   └── seed.sql              ← sample data
├── tests/test_smoke.py
├── requirements.txt
└── .env.example
```

## 1. Set up the database (once per Supabase project)

Our project: `https://nnpxgjnthmyknphjxhwu.supabase.co`

In Supabase → **SQL Editor**, run each file in its own **New query**, in this order:

1. `supabase/migrations/20261027000000_init_schema.sql`
2. `supabase/migrations/20261027100000_farmer_accounts.sql`
3. `supabase/migrations/20261027200000_volunteer_recipient_details.sql`
4. (Optional) `supabase/seed.sql` for sample data

Then go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email** while testing. Otherwise new accounts must click a link in their email before they can log in.

### Create a coordinator account
1. Supabase → **Authentication → Users → Add user → Create new user**. Enter an email and password, tick **Auto Confirm User**.
2. In the **SQL Editor**, give them the role and a name:

```sql
update public.profiles
set role = 'admin',            -- or 'coordinator' / 'volunteer'
    first_name = 'Carla',
    last_name  = 'Mendoza'
where id = (select id from auth.users where email = 'carla@example.com');
```

Now they can use the **Coordinator login** on the website.

### Password reset emails
"Forgot password?" is on both login cards. For the link in the email to open the website:

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL:** `http://localhost:5173` (or your website's address once it's online).
3. **Redirect URLs:** add `http://localhost:5173/**` (and your online address later). Click **Save**.

Supabase's built-in email sender only delivers to **members of your Supabase project** and only a few emails per hour. To send reset emails to any farmer, add your own email service under **Authentication → Emails → SMTP Settings** (for example Gmail with an app password, Brevo, or Resend).

## 2. Run the Python API

You need Python 3.9 or newer (the one built into macOS works).

```bash
cd backend
python3 -m venv .venv

# Mac / Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and paste the key from **Project Settings → API Keys** (the **publishable** key, or the legacy **anon public** key):

```
SUPABASE_URL=https://nnpxgjnthmyknphjxhwu.supabase.co
SUPABASE_ANON_KEY=paste-it-here
```

> Never use the `service_role` / secret key. `.env` is ignored by Git, so it won't be uploaded.

Start it (every new terminal needs `source .venv/bin/activate` first):

```bash
uvicorn app.main:app --reload --reload-dir app
```

Check it at **http://127.0.0.1:8000/docs**. You can try every endpoint there: log in with `POST /auth/signin`, copy the `access_token`, click **Authorize**, paste it.

## 3. Run the website

In a second terminal:

```bash
cd OLIS
npm install
npm run dev
```

Open **http://localhost:5173**. The website talks to the API at `http://127.0.0.1:8000`. To use a different address, create `OLIS/.env` with `VITE_API_URL=...`. If the website runs somewhere other than port 5173 or 8443, add it to `CORS_ORIGINS` in `backend/.env`.

**Everything is connected:** farmer sign-up, both logins, the farmer status page and farmer dashboard, and the coordinator Dashboard, Donations, Pickups, Farmers, Volunteers, Recipients and Reports pages.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/signup` | Farmer sign-up (`email`, `password`, `full_name`, `phone`, `farm_name`, `farm_address`, `cooperative`) |
| POST | `/auth/signin` | Log in. Send `role: "farmer"` or `"coordinator"` to match the login card |
| POST | `/auth/forgot` | Email a password-reset link (`email`, `redirect_to`) — farmers and coordinators |
| POST | `/auth/reset` | Set a new password with the token from the reset link (`access_token`, `password`) |
| POST | `/auth/refresh` | New access token (they expire after ~1 hour) |
| POST | `/auth/signout` | Sign out this device |
| GET / PATCH | `/auth/me` | Your profile, and your farm + status if you're a farmer |
| GET | `/farmer/dashboard` | Farmer: your farm, totals, and your donations |
| POST | `/farmer/donations` | Farmer: post surplus (approved farmers only) |
| PATCH | `/farmer/donations/{id}` | Farmer: edit a donation that isn't matched yet |
| POST | `/farmer/donations/{id}/cancel` | Farmer: cancel a donation that isn't matched yet |
| GET | `/dashboard?days=7` | Coordinator: stat cards, priority queue, activity, chart (`days=7` or `30`) |
| GET | `/sidebar` | Coordinator sidebar: last undoable change + pending-farmers count |
| POST | `/activity/undo` | Undo your most recent change (approve/reject, match, schedule, assign, deliver, cancel, add/edit/remove) |
| GET | `/reports?period=30d` | Reports: totals, change vs previous period, chart, where food went, top farms/produce/food banks/volunteers (`7d`, `30d`, `12m`) |
| GET / POST | `/farmers` | List (`?status=pending`, `?q=name`) / add |
| POST | `/farmers/{id}/approve`, `/reject`, `/suspend` | Review a farmer account |
| GET / POST | `/donations` | List (`?status=new`) / log a donation |
| GET / POST | `/pickups` | List (`?day=today`, `?unassigned=true`) / schedule |
| PATCH | `/pickups/{id}` | Assign a volunteer or set `status: "completed"` (marks the donation delivered) |
| GET / POST | `/volunteers`, `/recipients` | List / add |
| GET / PATCH / DELETE | `/{table}/{id}` | View, edit, or delete one item |

Every endpoint except signup/signin/refresh needs the header `Authorization: Bearer <access_token>`.

## Tests

```bash
pip install pytest httpx
pytest
```

## Changing the database later
Put each change in a **new** file in `supabase/migrations/` (e.g. `20261101000000_add_photos.sql`) and run it in the SQL Editor, so everyone in the group gets the same database.
