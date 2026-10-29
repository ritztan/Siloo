-- =====================================================================
-- Silo · Make every recipient an NGO partner and remove capacity
-- Run AFTER 20261029400000_partner_ngo_recipients.sql
-- =====================================================================

alter table public.recipients drop constraint if exists recipients_type_check;
alter table public.recipients drop constraint if exists recipients_type_check1;

update public.recipients set type = 'rescue_partner';

alter table public.recipients add constraint recipients_type_check
  check (type = 'rescue_partner');

alter table public.recipients drop column if exists capacity;
