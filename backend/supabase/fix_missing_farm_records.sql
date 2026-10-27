-- =====================================================================
-- Silo · Repair: farmers who signed up but don't appear for approval
--
-- Happens if someone signed up BEFORE 20261027100000_farmer_accounts.sql
-- was run. Their login exists, but no farm record was created.
-- Run AFTER that migration. Safe to run more than once.
-- =====================================================================

-- 1. Create the missing farm records from what they typed when signing up
insert into public.farmers (profile_id, farm_name, contact_name, email, phone, location, cooperative, status)
select
  u.id,
  u.raw_user_meta_data ->> 'farm_name',
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.email,
  u.raw_user_meta_data ->> 'phone',
  u.raw_user_meta_data ->> 'farm_address',
  nullif(u.raw_user_meta_data ->> 'cooperative', ''),
  'pending'
from auth.users u
where coalesce(u.raw_user_meta_data ->> 'farm_name', '') <> ''
  and not exists (select 1 from public.farmers f where f.profile_id = u.id);

-- 2. Make sure those accounts are farmer accounts (not coordinators)
update public.profiles p
set role = 'farmer',
    phone = coalesce(p.phone, u.raw_user_meta_data ->> 'phone'),
    first_name = case when p.first_name = '' then coalesce(u.raw_user_meta_data ->> 'full_name', '') else p.first_name end
from auth.users u
where u.id = p.id
  and coalesce(u.raw_user_meta_data ->> 'farm_name', '') <> ''
  and p.role <> 'farmer';

-- 3. Show who is waiting for approval now
select f.farm_name, f.contact_name, f.email, f.status, f.created_at
from public.farmers f
where f.status = 'pending'
order by f.created_at desc;
