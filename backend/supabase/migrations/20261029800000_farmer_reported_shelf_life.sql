-- Add the farmer-entered shelf-life field to databases that already ran the
-- original farmer portal migration before this field was introduced.
alter table public.donations
  add column if not exists farmer_shelf_life_days integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.donations'::regclass
      and conname = 'donations_farmer_shelf_life_days_check'
  ) then
    alter table public.donations
      add constraint donations_farmer_shelf_life_days_check
      check (farmer_shelf_life_days is null or farmer_shelf_life_days > 0);
  end if;
end;
$$;
