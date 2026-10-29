-- =====================================================================
-- Silo · Partner NGOs are recipients; retire volunteer pickup assignment
-- Run AFTER 20261027300000_farmer_portal.sql
-- =====================================================================

-- Preserve the sample setup as NGO recipient records, without converting
-- individual volunteer profiles into organizations.
do $$
begin
  if exists (
    select 1 from public.volunteers
    where id in (
      '33333333-0000-0000-0000-000000000001'::uuid,
      '33333333-0000-0000-0000-000000000002'::uuid,
      '33333333-0000-0000-0000-000000000003'::uuid
    )
  ) then
    insert into public.recipients (id, name, type, contact_name, address, capacity, needs, status)
    values
      ('33333333-0000-0000-0000-000000000001', 'Bayanihan Harvest Network', 'rescue_partner', 'Sample contact', 'Sampaloc, Manila', 'Partner NGO', 'Fruit, vegetables', 'open'),
      ('33333333-0000-0000-0000-000000000002', 'Green Bridge Foundation', 'rescue_partner', 'Sample contact', 'Quezon City', 'Partner NGO', 'Root vegetables', 'open'),
      ('33333333-0000-0000-0000-000000000003', 'Kalinga Food Alliance', 'rescue_partner', 'Sample contact', 'Pasig City', 'Partner NGO', 'Fresh produce', 'open')
    on conflict (id) do nothing;
  end if;
end;
$$;

-- The view depends on the volunteer assignment column.
drop view public.dashboard_stats;

alter table public.pickups drop column if exists volunteer_id;
drop table if exists public.volunteers;

-- Retire existing volunteer logins without granting them coordinator access.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_role_check1;
update public.profiles set role = 'retired' where role = 'volunteer';
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'coordinator', 'farmer', 'retired'));

comment on column public.profiles.role is
  'admin/coordinator manage data; farmer uses the farmer portal; retired is a deactivated legacy account.';

create or replace function public.is_staff()
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
  (select count(*) from public.farmers where status = 'pending')                 as farmers_pending,
  (select count(*) from public.donations
     where status in ('new', 'matched')
       and expires_at is not null
       and expires_at <= now() + interval '4 hours')                             as donations_expiring,
  (select coalesce(sum(quantity_kg), 0) from public.donations
     where status = 'delivered')                                                 as food_rescued_kg,
  (select count(*) from public.donations where status = 'delivered')             as delivered_donations;

grant select on public.dashboard_stats to authenticated;
