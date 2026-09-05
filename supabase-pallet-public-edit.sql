-- User requested public editing; retain atomic version checks and deny direct table writes.
create or replace function public.save_pallet_changes(p_slots jsonb default '[]', p_dates jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  entry jsonb;
  saved_slot public.pallet_slots;
  saved_date public.receive_dates;
  slots_out jsonb := '[]';
  dates_out jsonb := '[]';
  expected bigint;
begin
  if p_slots is null or p_dates is null or jsonb_typeof(p_slots) <> 'array' or jsonb_typeof(p_dates) <> 'array'
    or jsonb_array_length(p_slots) > 3000 or jsonb_array_length(p_dates) > 20000 then
    raise exception 'PALLET_INVALID: invalid batch' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct (v->>'zone',v->>'slot_code')) from jsonb_array_elements(p_slots) v)
    or (select count(*) <> count(distinct v->>'item_code') from jsonb_array_elements(p_dates) v) then
    raise exception 'PALLET_INVALID: duplicate batch keys' using errcode = '22023';
  end if;
  -- Deterministic lock order avoids deadlocks across overlapping imports.
  for entry in select value from jsonb_array_elements(p_slots) order by value->>'zone', value->>'slot_code' loop
    if jsonb_typeof(entry->'items') is distinct from 'array'
      or jsonb_typeof(entry->'occupied') is distinct from 'boolean'
      or coalesce(length(entry->>'zone'),0) not between 1 and 100
      or coalesce(length(entry->>'slot_code'),0) not between 1 and 100
      or coalesce(entry->>'expected_version','') !~ '^[0-9]+$' then
      raise exception 'PALLET_INVALID: invalid slot' using errcode = '22023';
    end if;
    expected := (entry->>'expected_version')::bigint;
    if expected = 0 then
      insert into public.pallet_slots(zone,slot_code,occupied,items)
        values(entry->>'zone',entry->>'slot_code',(entry->>'occupied')::boolean,entry->'items')
        on conflict do nothing returning * into saved_slot;
    else
      update public.pallet_slots set occupied = (entry->>'occupied')::boolean, items = entry->'items',
        version = version + 1, updated_at = clock_timestamp()
        where zone = entry->>'zone' and slot_code = entry->>'slot_code' and version = expected
        returning * into saved_slot;
    end if;
    if not found then
      raise exception 'PALLET_CONFLICT: % / %',entry->>'zone',entry->>'slot_code' using errcode = '40001';
    end if;
    slots_out := slots_out || jsonb_build_array(to_jsonb(saved_slot));
  end loop;
  for entry in select value from jsonb_array_elements(p_dates) order by value->>'item_code' loop
    if coalesce(length(entry->>'item_code'),0) not between 1 and 200
      or coalesce(entry->>'expected_version','') !~ '^[0-9]+$' then
      raise exception 'PALLET_INVALID: invalid receive date' using errcode = '22023';
    end if;
    expected := (entry->>'expected_version')::bigint;
    if expected = 0 then
      insert into public.receive_dates(item_code,receive_date)
        values(entry->>'item_code',(entry->>'receive_date')::date)
        on conflict do nothing returning * into saved_date;
    else
      update public.receive_dates set receive_date = (entry->>'receive_date')::date,
        version = version + 1, updated_at = clock_timestamp()
        where item_code = entry->>'item_code' and version = expected returning * into saved_date;
    end if;
    if not found then
      raise exception 'PALLET_CONFLICT: receive date %',entry->>'item_code' using errcode = '40001';
    end if;
    dates_out := dates_out || jsonb_build_array(to_jsonb(saved_date));
  end loop;
  return jsonb_build_object('slots',slots_out,'dates',dates_out);
end;
$$;
revoke all on function public.save_pallet_changes(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_pallet_changes(jsonb,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
