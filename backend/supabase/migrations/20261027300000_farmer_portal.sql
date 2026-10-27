-- =====================================================================
-- Silo · Farmer portal
-- Run AFTER 20261027200000_volunteer_recipient_details.sql
--
--  * crops: the crop shelf-life table behind "Crop type"
--  * donations: harvest date, condition, unit, pickup/deliver, pickup point,
--    shelf life, Rejected (+ reason), Expired, and when each status happened
--  * farmers: usual logistics (pickup or deliver)
--  * farmers can delete a donation while it is still Posted
--  * farmers can edit their own contact/farm details (not their status)
-- =====================================================================

-- ---------- crop shelf-life table ----------
create table if not exists public.crops (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  shelf_life_days  integer not null check (shelf_life_days > 0),
  created_at       timestamptz not null default now()
);

alter table public.crops enable row level security;

drop policy if exists "Signed-in users can view crops" on public.crops;
create policy "Signed-in users can view crops"
  on public.crops for select to authenticated using (true);
drop policy if exists "Coordinators manage crops" on public.crops;
create policy "Coordinators manage crops"
  on public.crops for all to authenticated
  using ((select public.is_coordinator())) with check ((select public.is_coordinator()));

-- Typical shelf life at room temperature, in days (edit in Table Editor if needed)
insert into public.crops (name, shelf_life_days) values
  ('Ampalaya', 5), ('Banana', 5), ('Cabbage', 14), ('Calamansi', 10),
  ('Carrots', 21), ('Corn', 3), ('Eggplant', 7), ('Garlic', 60),
  ('Ginger', 30), ('Kangkong', 2), ('Lettuce', 5), ('Malunggay', 2),
  ('Mango', 5), ('Okra', 4), ('Onions', 30), ('Papaya', 5),
  ('Pechay', 3), ('Potatoes', 30), ('Radish', 10), ('Rice', 180),
  ('Sayote', 14), ('Sitaw', 4), ('Squash', 30), ('Sweet potato', 21),
  ('Tomatoes', 7)
on conflict (name) do nothing;

-- ---------- donations: new details ----------
alter table public.donations add column if not exists crop_id uuid references public.crops (id) on delete set null;
alter table public.donations add column if not exists quantity numeric(10, 2);          -- as typed
alter table public.donations add column if not exists unit text not null default 'kg';  -- kg | g | tonne
alter table public.donations add column if not exists harvested_at date;
alter table public.donations add column if not exists condition text;
alter table public.donations add column if not exists logistics text not null default 'pickup';
alter table public.donations add column if not exists use_saved_location boolean not null default true;
alter table public.donations add column if not exists pickup_address text;  -- where to collect it
alter table public.donations add column if not exists shelf_life_days integer;
alter table public.donations add column if not exists rejection_reason text;
alter table public.donations add column if not exists matched_at timestamptz;
alter table public.donations add column if not exists rejected_at timestamptz;
alter table public.donations add column if not exists expired_at timestamptz;

-- Replace the status / unit / condition / logistics rules (whatever they were named)
do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.donations'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%status%' or pg_get_constraintdef(oid) ilike '%unit%'
           or pg_get_constraintdef(oid) ilike '%condition%' or pg_get_constraintdef(oid) ilike '%logistics%')
      and pg_get_constraintdef(oid) not ilike '%quantity_kg%'
  loop
    execute format('alter table public.donations drop constraint %I', con.conname);
  end loop;
end;
$$;

alter table public.donations add constraint donations_status_check
  check (status in ('new', 'matched', 'pickup_scheduled', 'delivered', 'rejected', 'expired', 'cancelled'));
alter table public.donations add constraint donations_unit_check check (unit in ('kg', 'g', 'tonne'));
alter table public.donations add constraint donations_condition_check
  check (condition is null or condition in ('fresh', 'good', 'fair'));
alter table public.donations add constraint donations_logistics_check check (logistics in ('pickup', 'deliver'));

-- Remember when each status happened (for the farmer's status history)
create or replace function public.stamp_donation_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'matched' and new.matched_at is null then new.matched_at = now(); end if;
    if new.status = 'rejected' then new.rejected_at = now(); end if;
    if new.status = 'expired' then new.expired_at = now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at = now(); end if;
    -- moved back to Posted (e.g. undo): clear the later steps
    if new.status = 'new' then
      new.matched_at = null; new.rejected_at = null; new.expired_at = null; new.rejection_reason = null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists donations_stamp_status on public.donations;
create trigger donations_stamp_status
  before update on public.donations
  for each row execute function public.stamp_donation_status();

-- Posted donations past their shelf life become Expired.
-- Called by the backend whenever donations are listed (no scheduler needed).
create or replace function public.expire_overdue_donations()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.donations
    set status = 'expired'
    where status = 'new' and expires_at is not null and expires_at < now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

grant execute on function public.expire_overdue_donations() to authenticated;

-- Farmers can delete a donation while it is still Posted
drop policy if exists "Farmers can delete new donations" on public.donations;
create policy "Farmers can delete new donations"
  on public.donations for delete to authenticated
  using (farmer_id = (select public.my_farmer_id()) and status = 'new');

-- ---------- farmers: usual logistics ----------
alter table public.farmers add column if not exists usual_logistics text not null default 'pickup';
alter table public.farmers drop constraint if exists farmers_usual_logistics_check;
alter table public.farmers add constraint farmers_usual_logistics_check check (usual_logistics in ('pickup', 'deliver'));

-- Farmers edit their own details through this function, so they can never
-- change their own status (approved / suspended).
create or replace function public.update_my_farm(details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  full_name text := nullif(trim(details ->> 'contact_name'), '');
begin
  if not exists (select 1 from public.farmers where profile_id = auth.uid()) then
    raise exception 'No farm on this account';
  end if;

  update public.farmers set
    contact_name    = coalesce(full_name, contact_name),
    phone           = coalesce(nullif(trim(details ->> 'phone'), ''), phone),
    email           = coalesce(nullif(trim(details ->> 'email'), ''), email),
    cooperative     = case when details ? 'cooperative' then nullif(trim(details ->> 'cooperative'), '') else cooperative end,
    farm_name       = coalesce(nullif(trim(details ->> 'farm_name'), ''), farm_name),
    location        = case when details ? 'location' then nullif(trim(details ->> 'location'), '') else location end,
    usual_logistics = coalesce(details ->> 'usual_logistics', usual_logistics)
  where profile_id = auth.uid();

  if full_name is not null then
    update public.profiles set
      first_name = case when full_name like '% %' then regexp_replace(full_name, '\s+\S+$', '') else full_name end,
      last_name  = case when full_name like '% %' then regexp_replace(full_name, '^.*\s', '') else '' end,
      organization = coalesce(nullif(trim(details ->> 'cooperative'), ''), organization)
    where id = auth.uid();
  end if;
  if nullif(trim(details ->> 'phone'), '') is not null then
    update public.profiles set phone = trim(details ->> 'phone') where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.update_my_farm(jsonb) to authenticated;
