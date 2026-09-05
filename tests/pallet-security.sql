-- Run via SQL admin in one transaction. All fixtures and writes are rolled back.
begin;
set local role anon;
do $
declare result jsonb; rejected boolean;
begin
  result := public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":false,"items":[],"expected_version":0}]','[]');
  if result->'slots'->0->>'version' <> '1' then raise exception 'Insert version incorrect'; end if;
  result := public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":true,"items":[],"expected_version":1}]','[]');
  if result->'slots'->0->>'version' <> '2' then raise exception 'Update version incorrect'; end if;
  rejected := false;
  begin perform public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":false,"items":[],"expected_version":1}]','[]');
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'Stale slot write accepted'; end if;
  rejected := false;
  begin perform public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":false,"items":[],"expected_version":2},{"zone":"__REGRESSION__","slot_code":"B","occupied":false,"items":[],"expected_version":99}]','[]');
  exception when serialization_failure then rejected := true; end;
  if not rejected or (select version from public.pallet_slots where zone='__REGRESSION__' and slot_code='A') <> 2 then
    raise exception 'Partial import committed'; end if;
  result := public.save_pallet_changes('[]','[{"item_code":"__REGRESSION__","receive_date":"2026-09-05","expected_version":0}]');
  rejected := false;
  begin perform public.save_pallet_changes('[]','[{"item_code":"__REGRESSION__","receive_date":"2026-09-06","expected_version":0}]');
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'Date creation race accepted'; end if;
end $$;
rollback;
select 'PASS: anonymous versioned writes, stale-write rejection, atomic import rollback and date creation race' as result;
