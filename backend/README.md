# Silo backend (Python + Supabase)

```
Website (OLIS)  ──►  Python API (FastAPI)  ──►  Supabase (database + logins)
```

- **Supabase** stores the data and handles accounts.
- **The Python API** (this folder) is what the website calls: sign up, sign in, dashboard numbers, donations, pickups, etc.
- Every request runs **as the signed-in user**, so the security rules in the database decide what they can see and change. The backend never uses the secret `service_role` key.

```
backend/
├── app/
│   ├── main.py            ← starts the API
│   ├── config.py          ← reads .env
│   ├── db.py              ← Supabase connection + error handling
│   ├── schemas.py         ← what each request must contain
│   └── routers/
│       ├── auth.py        ← /auth/signup, /auth/signin, /auth/me ...
│       ├── dashboard.py   ← /dashboard (everything the Dashboard page shows)
│       ├── resources.py   ← /farmers, /volunteers, /recipients, /donations, /pickups
│       └── crud.py        ← shared list/get/create/update/delete logic
├── supabase/
│   ├── migrations/...init_schema.sql   ← tables, security rules, views
│   └── seed.sql                        ← sample data
├── tests/test_smoke.py
├── requirements.txt
└── .env.example
```

## 1. Set up the database (once per Supabase project)

Our project: `https://nnpxgjnthmyknphjxhwu.supabase.co`

1. Open the project at [supabase.com/dashboard](https://supabase.com/dashboard) → **SQL Editor** → **New query**.
2. Paste everything from `supabase/migrations/20261027000000_init_schema.sql` and click **Run**.
3. (Optional) New query → paste `supabase/seed.sql` → **Run** for sample data.
4. For easy testing, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. Otherwise new accounts must click a link in their email before signing in.

## 2. Run the Python API

You need Python 3.10 or newer.

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and paste the key from **Project Settings → API Keys** (the **publishable** key, or the legacy **anon public** key):

```
SUPABASE_URL=https://nnpxgjnthmyknphjxhwu.supabase.co
SUPABASE_ANON_KEY=paste-it-here
```

> Never use the `service_role` / secret key. `.env` is already ignored by Git, so it won't be uploaded.

Start it:

```bash
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000/docs**. You'll see every endpoint and can try them right in the browser:

1. `POST /auth/signup` → create an account
2. `POST /auth/signin` → copy the `access_token`
3. Click **Authorize** (top right), paste the token, then try `GET /dashboard`

### Make yourself admin
After signing up once, run this in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Roles: `admin` and `coordinator` can add/edit/delete. `volunteer` can only view. New accounts are coordinators.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/signup` | Create account (`email`, `password`, `first_name`, `last_name`, `organization`) |
| POST | `/auth/signin` | Returns `access_token` + `refresh_token` |
| POST | `/auth/refresh` | New access token (they expire after ~1 hour) |
| POST | `/auth/signout` | Sign out this device |
| GET / PATCH | `/auth/me` | Your profile |
| GET | `/dashboard?days=7` | Stat cards, priority queue, recent activity, chart data (`days=7` or `30`) |
| GET / POST | `/farmers` | List (`?status=pending`, `?q=name`) / add |
| POST | `/farmers/{id}/approve`, `/reject` | Review a farmer application |
| GET / POST | `/donations` | List (`?status=new`) / log a donation |
| GET / POST | `/pickups` | List (`?day=today`, `?unassigned=true`) / schedule |
| PATCH | `/pickups/{id}` | Assign a volunteer or set `status: "completed"` (marks the donation delivered) |
| GET / POST | `/volunteers`, `/recipients` | List / add |
| GET / PATCH / DELETE | `/{table}/{id}` | View, edit, or delete one item |

Every endpoint except signup/signin/refresh needs the header `Authorization: Bearer <access_token>`.

## 3. Call it from the website

Add to `OLIS/.env`:

```
VITE_API_URL=http://127.0.0.1:8000
```

Example (`OLIS/src/lib/api.ts`):

```ts
const API = import.meta.env.VITE_API_URL

export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('silo-token')
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = res.status === 204 ? null : await res.json()
  if (!res.ok) throw new Error(data?.detail?.message ?? data?.detail ?? 'Request failed')
  return data
}

// Sign in
const session = await api('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) })
localStorage.setItem('silo-token', session.access_token)

// Dashboard
const dashboard = await api('/dashboard')
```

If the website runs on a different address than `localhost:5173` or `localhost:8443`, add it to `CORS_ORIGINS` in `backend/.env`.

## Tests

```bash
pip install pytest httpx
pytest
```

## Changing the database later
Put each change in a **new** file in `supabase/migrations/` (e.g. `20261101000000_add_photos.sql`) and run it in the SQL Editor, so everyone in the group gets the same database.
