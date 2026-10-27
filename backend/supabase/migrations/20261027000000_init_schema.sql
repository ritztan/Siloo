-- =====================================================================
-- Silo · Food rescue network
-- Initial database schema for Supabase
--
-- Tables match the screens in the web app:
--   profiles    -> signed-in users (sign-up form: first/last name, organization)
--   farmers     -> Farmers page + "Farmers pending" review queue
--   volunteers  -> Volunteers page, assigned to pickups
--   recipients  -> Recipients page (food banks, kitchens, pantries)
--   donations   -> Donations page + "Donation activity" table
--   pickups     -> Pickups page + "Pickups today"
--   activity_log-> "Undo last action" card
-- Views:
--   dashboard_stats      -> the four stat cards on the Dashboard
--   rescue_volume_daily  -> the "Rescue volume" chart
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles (one row per Supabase Auth user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  organization text not null default '',
  role         text not null default 'coordinator'
               check (role in ('admin', 'coordinator', 'volunteer')),
  created_at   timestamptz not null default now()
);

comment on column public.profiles.role is
  'admin and coordinator can manage data; volunteer can only read. New sign-ups are coordinators.';

-- ---------------------------------------------------------------------
-- Farmers (donors). New applications start as pending.
-- ---------------------------------------------------------------------
create table public.farmers (
  id           uuid primary key default gen_random_uuid(),
  farm_name    text not null,
  contact_name text not null default '',
  email        text,
  phone        text,
  location     text,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Volunteers (drivers who do pickups)
-- ---------------------------------------------------------------------
create table public.volunteers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles (id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Recipients (food banks, community kitchens, pantries)
-- ---------------------------------------------------------------------
create table public.recipients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null default 'food_bank'
               check (type in ('food_bank', 'kitchen', 'pantry', 'shelter', 'other')),
  contact_name text,
  phone        text,
  address      text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Donations (surplus harvest logged from a farmer)
-- ---------------------------------------------------------------------
create table public.donations (
  id            uuid primary key default gen_random_uuid(),
  produce       text not null,
  quantity_kg   numeric(10, 2) not null check (quantity_kg > 0),
  farmer_id     uuid not null references public.farmers (id) on delete restrict,
  recipient_id  uuid references public.recipients (id) on delete set null,
  status        text not null default 'new'
                check (status in ('new', 'matched', 'pickup_scheduled', 'delivered', 'expired', 'cancelled')),
  expires_at    timestamptz,
  delivered_at  timestamptz,
  notes         text,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index donations_status_idx on public.donations (status);
create index donations_farmer_idx on public.donations (farmer_id);
create index donations_recipient_idx on public.donations (recipient_id);

-- ---------------------------------------------------------------------
-- Pickups (moving a donation from farm to recipient)
-- ---------------------------------------------------------------------
create table public.pickups (
  id            uuid primary key default gen_random_uuid(),
  donation_id   uuid not null references public.donations (id) on delete cascade,
  volunteer_id  uuid references public.volunteers (id) on delete set null,
  scheduled_at  timestamptz not null,
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index pickups_scheduled_idx on public.pickups (scheduled_at);
create index pickups_donation_idx on public.pickups (donation_id);
create index pickups_volunteer_idx on public.pickups (volunteer_id);

-- ---------------------------------------------------------------------
-- Activity log (powers "Undo last action")
-- ---------------------------------------------------------------------
create table public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  action      text not null,              -- e.g. 'donation.created', 'farmer.approved'
  table_name  text not null,
  record_id   uuid,
  before_data jsonb,                      -- row before the change (null on insert)
  created_at  timestamptz not null default now()
);

create index activity_log_actor_idx on public.activity_log (actor_id, created_at desc);

-- =====================================================================
-- Helpers & triggers
-- =====================================================================

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger donations_set_updated_at
  before update on public.donations
  for each row execute function public.set_updated_at();

create trigger pickups_set_updated_at
  before update on public.pickups
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone signs up.
-- The app should pass first_name, last_name, organization in
-- supabase.auth.signUp({ options: { data: {...} } }).
-- Role is NOT read from sign-up data, so users can't make themselves admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, organization)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'organization', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the current user allowed to manage data?
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'coordinator')
  );
$$;

-- Stop users from changing their own role (only admins can).
-- Changes made without a signed-in user (Supabase SQL Editor, Table Editor,
-- service-role key) are allowed, so you can promote your first admin there.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- =====================================================================
-- Row Level Security
-- Signed-in users can read everything; coordinators/admins can write.
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.farmers      enable row level security;
alter table public.volunteers   enable row level security;
alter table public.recipients   enable row level security;
alter table public.donations    enable row level security;
alter table public.pickups      enable row level security;
alter table public.activity_log enable row level security;

-- Profiles
create policy "Signed-in users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Shared read + coordinator write for the operational tables
do $$
declare
  t text;
begin
  foreach t in array array['farmers', 'volunteers', 'recipients', 'donations', 'pickups']
  loop
    execute format(
      'create policy "Signed-in users can view %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format(
      'create policy "Coordinators can add %1$s" on public.%1$I for insert to authenticated with check ((select public.is_coordinator()))', t);
    execute format(
      'create policy "Coordinators can edit %1$s" on public.%1$I for update to authenticated using ((select public.is_coordinator())) with check ((select public.is_coordinator()))', t);
    execute format(
      'create policy "Coordinators can delete %1$s" on public.%1$I for delete to authenticated using ((select public.is_coordinator()))', t);
  end loop;
end;
$$;

-- Activity log: you see and write only your own entries
create policy "Users can view their own activity"
  on public.activity_log for select to authenticated
  using ((select auth.uid()) = actor_id);
create policy "Users can log their own activity"
  on public.activity_log for insert to authenticated
  with check ((select auth.uid()) = actor_id);
create policy "Users can remove their own activity"
  on public.activity_log for delete to authenticated
  using ((select auth.uid()) = actor_id);

-- =====================================================================
-- Dashboard views (respect RLS of the person querying)
-- =====================================================================
create view public.dashboard_stats
with (security_invoker = true)
as
select
  (select count(*) from public.donations
     where status in ('new', 'matched', 'pickup_scheduled'))                     as active_donations,
  (select count(*) from public.donations
     where created_at >= date_trunc('day', now()))                               as donations_today,
  (select count(*) from public.pickups
     where scheduled_at >= date_trunc('day', now())
       and scheduled_at <  date_trunc('day', now()) + interval '1 day'
       and status <> 'cancelled')                                                as pickups_today,
  (select min(scheduled_at) from public.pickups
     where scheduled_at >= now() and status = 'scheduled')                       as next_pickup_at,
  (select count(*) from public.pickups
     where status = 'scheduled' and volunteer_id is null)                        as pickups_unassigned,
  (select count(*) from public.farmers where status = 'pending')                 as farmers_pending,
  (select count(*) from public.donations
     where status in ('new', 'matched')
       and expires_at is not null
       and expires_at <= now() + interval '4 hours')                             as donations_expiring,
  (select coalesce(sum(quantity_kg), 0) from public.donations
     where status = 'delivered')                                                 as food_rescued_kg,
  (select count(*) from public.donations where status = 'delivered')             as delivered_donations;

create view public.rescue_volume_daily
with (security_invoker = true)
as
select
  date_trunc('day', coalesce(delivered_at, updated_at))::date as day,
  sum(quantity_kg)                                            as kg_rescued,
  count(*)                                                    as donations
from public.donations
where status = 'delivered'
group by 1
order by 1;

-- Activity table on the Dashboard (donation + farm + recipient in one row)
create view public.donation_activity
with (security_invoker = true)
as
select
  d.id,
  d.produce,
  d.quantity_kg,
  d.status,
  d.expires_at,
  d.created_at,
  f.farm_name,
  r.name as recipient_name,
  (select min(p.scheduled_at) from public.pickups p
     where p.donation_id = d.id and p.status = 'scheduled') as next_pickup_at
from public.donations d
join public.farmers f on f.id = d.farmer_id
left join public.recipients r on r.id = d.recipient_id
order by d.created_at desc;

grant select on public.dashboard_stats, public.rescue_volume_daily, public.donation_activity to authenticated;
