-- Remove the pallet-login authorization left behind after public pallet editing
-- replaced the old editor allow-list. A one-row CSV backup was exported to
-- C:/Users/ADMIN/Downloads/pallet_editors_backup_2026-09-22.csv.
-- Applied in the SQL Editor of project zgsxbuckjrplkpvtlbmn on 2026-09-22.
-- This intentionally does not use CASCADE or touch stock/pallet/audit data.

begin;

do $$
declare
  active_writer oid := to_regprocedure('public.save_pallet_changes(jsonb,jsonb)');
  other_reference text;
begin
  if to_regclass('public.pallet_editors') is null then
    raise exception 'Cleanup stopped: public.pallet_editors is absent';
  end if;
  if (select count(*) from public.pallet_editors) <> 1 then
    raise exception 'Cleanup stopped: the editor row count has changed since backup';
  end if;
  if active_writer is null then
    raise exception 'Cleanup stopped: current pallet writer was not found';
  end if;
  if pg_get_functiondef(active_writer) ~* 'can_edit_pallets|pallet_editors' then
    raise exception 'Cleanup stopped: the active pallet writer still uses editor authorization';
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into other_reference
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname <> 'can_edit_pallets'
     and p.oid <> active_writer
     and p.prokind in ('f', 'p')
     and pg_get_functiondef(p.oid) ~* 'can_edit_pallets|pallet_editors';
  if other_reference is not null then
    raise exception 'Cleanup stopped: other functions still refer to old editor auth: %', other_reference;
  end if;
end $$;

drop function if exists public.can_edit_pallets();
drop table public.pallet_editors;
notify pgrst, 'reload schema';

commit;
