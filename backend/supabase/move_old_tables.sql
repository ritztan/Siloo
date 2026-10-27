-- One-time fix for projects that already had an older Silo database.
-- Run this BEFORE migrations/20261027000000_init_schema.sql.
-- Move the old Silo tables aside as old_* (nothing is deleted)
do $$
declare
  t text;
  idx record;
  seq record;
  trg record;
begin
  foreach t in array array['profiles','donations','pickups','recipients','volunteers','distributions']
  loop
    if to_regclass('public.' || t) is not null then
      -- rename indexes first (primary keys, unique keys...) so their names are free
      for idx in
        select i.relname from pg_index x
        join pg_class i on i.oid = x.indexrelid
        where x.indrelid = ('public.' || t)::regclass
      loop
        execute format('alter index public.%I rename to %I', idx.relname, left('old_' || idx.relname, 63));
      end loop;
      -- rename sequences owned by the table (auto-number ids)
      for seq in
        select s.relname from pg_class s
        join pg_depend d on d.objid = s.oid and d.deptype in ('a', 'i')
        where s.relkind = 'S' and d.refobjid = ('public.' || t)::regclass
      loop
        execute format('alter sequence public.%I rename to %I', seq.relname, left('old_' || seq.relname, 63));
      end loop;
      execute format('alter table public.%I rename to %I', t, 'old_' || t);
      raise notice 'Renamed % to old_%', t, t;
    end if;
  end loop;

  -- Remove old sign-up triggers that write into profiles (the new script adds its own)
  for trg in
    select tg.tgname from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%profiles%'
  loop
    execute format('drop trigger %I on auth.users', trg.tgname);
    raise notice 'Removed old sign-up trigger %', trg.tgname;
  end loop;
end;
$$;
