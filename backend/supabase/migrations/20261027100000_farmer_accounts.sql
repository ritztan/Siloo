-- =====================================================================
-- Silo · Farmer accounts
-- Run AFTER 20261027000000_init_schema.sql
--
-- * Public sign-up is for farmers only. Each sign-up creates a profile
--   (role 'farmer') and a farmers row with status 'pending'.
-- * Coordinators are created by an admin (Supabase dashboard ->
--   Authentication -> Add user), then given the coordinator role with SQL.
-- * Farmers only see their own farm, donations and pickups.
-- =====================================================================

-- ---------- profiles: add farmer role + phone ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'coordinator', 'volunteer', 'farmer'));
alter table public.profiles alter column role set default 'farmer';
alter table public.profiles add column if not exists phone text;

comment on column public.profiles.role is
  'admin/coordinator manage everything; volunteer can view; farmer sees only their own farm. New sign-ups are farmers.';

-- ---------- farmers: link to an account, more details, suspended ----------
alter table public.farmers add column if not exists profile_id uuid unique
  references public.profiles (id) on delete set null;
alter table public.farmers add column if not exists cooperative text;
alter table public.farmers drop constraint if exists farmers_status_check;
alter table public.farmers add constraint farmers_status_check
  check (status in ('pending', 'approved', 'rejected', 'suspended'));

-- ---------- sign-up trigger ----------
-- Reads the details the farmer typed into the sign-up form.
-- Role is never taken from sign-up data, so nobody can sign up as coordinator.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := trim(coalesce(meta ->> 'full_name', ''));
  first_part text := full_name;
  last_part text := '';
begin
  if full_name like '% %' then
    first_part := regexp_replace(full_name, '\s+\S+$', '');
    last_part := regexp_replace(full_name, '^.*\s', '');
  end if;

  insert into public.profiles (id, first_name, last_name, organization, phone, role)
  values (
    new.id,
    coalesce(nullif(meta ->> 'first_name', ''), first_part),
    coalesce(nullif(meta ->> 'last_name', ''), last_part),
    coalesce(meta ->> 'organization', meta ->> 'cooperative', ''),
    meta ->> 'phone',
    'farmer'
  );

  if coalesce(meta ->> 'farm_name', '') <> '' then
    insert into public.farmers (profile_id, farm_name, contact_name, email, phone, location, cooperative, status)
    values (
      new.id,
      meta ->> 'farm_name',
      full_name,
      new.email,
      meta ->> 'phone',
      meta ->> 'farm_address',
      nullif(meta ->> 'cooperative', ''),
      'pending'
    );
  end if;

  return new;
end;
$$;

-- ---------- helpers ----------
-- Staff = can view everything (admin, coordinator, volunteer)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'coordinator', 'volunteer')
  );
$$;

-- The signed-in farmer's farm id (null for everyone else)
create or replace function public.my_farmer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.farmers where profile_id = auth.uid();
$$;

-- Is the signed-in farmer approved to post donations?
create or replace function public.my_farmer_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farmers where profile_id = auth.uid() and status = 'approved'
  );
$$;

-- =====================================================================
-- Visibility rules (replace the "everyone signed in can see everything" ones)
-- =====================================================================

-- profiles: yourself, or staff see all
drop policy if exists "Signed-in users can view profiles" on public.profiles;
create policy "Users see own profile; staff see all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

-- farmers: your own farm, or staff see all
drop policy if exists "Signed-in users can view farmers" on public.farmers;
create policy "Farmers see own farm; staff see all"
  on public.farmers for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_staff()));

-- donations: your farm's donations, or staff see all
drop policy if exists "Signed-in users can view donations" on public.donations;
create policy "Farmers see own donations; staff see all"
  on public.donations for select to authenticated
  using (farmer_id = (select public.my_farmer_id()) or (select public.is_staff()));

-- approved farmers can post donations for their own farm (always status 'new')
drop policy if exists "Approved farmers can post donations" on public.donations;
create policy "Approved farmers can post donations"
  on public.donations for insert to authenticated
  with check (
    farmer_id = (select public.my_farmer_id())
    and (select public.my_farmer_is_approved())
    and status = 'new'
    and recipient_id is null
  );

-- farmers can edit or cancel their own donations while they are still 'new'
drop policy if exists "Farmers can edit new donations" on public.donations;
create policy "Farmers can edit new donations"
  on public.donations for update to authenticated
  using (farmer_id = (select public.my_farmer_id()) and status = 'new')
  with check (
    farmer_id = (select public.my_farmer_id())
    and status in ('new', 'cancelled')
    and recipient_id is null
  );

-- pickups: pickups of your donations, or staff see all
drop policy if exists "Signed-in users can view pickups" on public.pickups;
create policy "Farmers see own pickups; staff see all"
  on public.pickups for select to authenticated
  using (
    (select public.is_staff())
    or donation_id in (select id from public.donations where farmer_id = (select public.my_farmer_id()))
  );

-- recipients and volunteers stay readable by everyone signed in
-- (farmers see which food bank and volunteer handle their donation).
