-- =====================================================================
-- Silo · Volunteer and recipient details
-- Run AFTER 20261027100000_farmer_accounts.sql
--
-- Adds what the Volunteers and Recipients pages show:
--   volunteers: service area, vehicle, how much it can carry
--   recipients: capacity, priority needs, open / limited / closed
-- =====================================================================

-- ---------- volunteers ----------
alter table public.volunteers add column if not exists service_area text;
alter table public.volunteers add column if not exists vehicle_type text not null default 'none';
alter table public.volunteers add column if not exists capacity_kg numeric(10, 2);
alter table public.volunteers drop constraint if exists volunteers_vehicle_type_check;
alter table public.volunteers add constraint volunteers_vehicle_type_check
  check (vehicle_type in ('none', 'motorcycle', 'car', 'pickup', 'van', 'truck'));
alter table public.volunteers drop constraint if exists volunteers_capacity_kg_check;
alter table public.volunteers add constraint volunteers_capacity_kg_check
  check (capacity_kg is null or capacity_kg >= 0);

comment on column public.volunteers.is_active is 'false = off duty (not offered when assigning pickups)';

-- ---------- recipients ----------
alter table public.recipients add column if not exists capacity text;   -- e.g. '120 meals / day'
alter table public.recipients add column if not exists needs text;      -- e.g. 'Fruit, vegetables'
alter table public.recipients add column if not exists status text not null default 'open';
alter table public.recipients drop constraint if exists recipients_status_check;
alter table public.recipients add constraint recipients_status_check
  check (status in ('open', 'limited', 'closed'));
alter table public.recipients drop constraint if exists recipients_type_check;
alter table public.recipients add constraint recipients_type_check
  check (type in ('food_bank', 'kitchen', 'pantry', 'shelter', 'rescue_partner', 'other'));

comment on column public.recipients.status is 'closed = not offered when matching donations';

-- ---------- fill in the sample rows (only if seed.sql was loaded) ----------
update public.volunteers set service_area = 'Sampaloc, Manila', vehicle_type = 'van', capacity_kg = 500
  where id = '33333333-0000-0000-0000-000000000001' and service_area is null;
update public.volunteers set service_area = 'Quezon City', vehicle_type = 'pickup', capacity_kg = 300
  where id = '33333333-0000-0000-0000-000000000002' and service_area is null;
update public.volunteers set service_area = 'Pasig City', vehicle_type = 'car', capacity_kg = 80
  where id = '33333333-0000-0000-0000-000000000003' and service_area is null;

update public.recipients set capacity = '120 meals / day', needs = 'Fruit, vegetables'
  where id = '22222222-0000-0000-0000-000000000001' and capacity is null;
update public.recipients set capacity = '350 households', needs = 'Root vegetables'
  where id = '22222222-0000-0000-0000-000000000002' and capacity is null;
update public.recipients set capacity = '80 households', needs = 'Fresh produce'
  where id = '22222222-0000-0000-0000-000000000003' and capacity is null;
update public.recipients set capacity = '200 meals / day', needs = 'Leafy greens', status = 'limited'
  where id = '22222222-0000-0000-0000-000000000004' and capacity is null;
