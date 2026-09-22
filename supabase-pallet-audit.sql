-- Apply once to the existing Supabase project. Existing pallet rows are untouched.
-- Audit rows are written by the same transaction as each version-checked pallet save.
begin;

create table if not exists public.pallet_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  zone text not null,
  slot_code text not null,
  action text not null,
  actor_name text not null,
  document_no text not null,
  before_version bigint,
  after_version bigint not null,
  before_occupied boolean,
  after_occupied boolean not null,
  before_items jsonb not null,
  after_items jsonb not null
);
create index if not exists pallet_audit_log_slot_idx on public.pallet_audit_log (zone, slot_code, id desc);
create index if not exists pallet_audit_log_time_idx on public.pallet_audit_log (id desc);
alter table public.pallet_audit_log enable row level security;
revoke all on public.pallet_audit_log from public, anon, authenticated;
grant select on public.pallet_audit_log to anon, authenticated;
drop policy if exists pallet_audit_read on public.pallet_audit_log;
create policy pallet_audit_read on public.pallet_audit_log for select to anon, authenticated using (true);

create or replace function public.capture_pallet_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare meta jsonb;
begin
  if tg_op = 'UPDATE' and old.items = new.items and old.occupied = new.occupied then return new; end if;
  meta := coalesce(nullif(pg_catalog.current_setting('app.pallet_audit_meta', true), '')::jsonb, '{}'::jsonb);
  insert into public.pallet_audit_log
    (zone,slot_code,action,actor_name,document_no,before_version,after_version,
     before_occupied,after_occupied,before_items,after_items)
  values
    (new.zone,new.slot_code,coalesce(nullif(meta->>'action',''),'adjust'),
     coalesce(nullif(meta->>'actor',''),'ไม่ระบุผู้บันทึก'),
     coalesce(nullif(meta->>'document_no',''),'ไม่ระบุเลขเอกสาร'),
     case when tg_op = 'INSERT' then null else old.version end,new.version,
     case when tg_op = 'INSERT' then null else old.occupied end,new.occupied,
     case when tg_op = 'INSERT' then '[]'::jsonb else old.items end,new.items);
  return new;
end;
$$;
revoke all on function public.capture_pallet_audit() from public, anon, authenticated;
drop trigger if exists pallet_audit_after_write on public.pallet_slots;
create trigger pallet_audit_after_write after insert or update on public.pallet_slots
  for each row execute function public.capture_pallet_audit();

create or replace function public.save_pallet_changes(p_slots jsonb default '[]', p_dates jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  entry jsonb;
  saved_slot public.pallet_slots;
  saved_date public.receive_dates;
  slots_out jsonb := '[]';
  dates_out jsonb := '[]';
  expected bigint;
  audit_meta jsonb;
begin
  if p_slots is null or p_dates is null or jsonb_typeof(p_slots) <> 'array' or jsonb_typeof(p_dates) <> 'array'
    or jsonb_array_length(p_slots) > 3000 or jsonb_array_length(p_dates) > 20000 then
    raise exception 'PALLET_INVALID: invalid batch' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct (v->>'zone',v->>'slot_code')) from jsonb_array_elements(p_slots) v)
    or (select count(*) <> count(distinct v->>'item_code') from jsonb_array_elements(p_dates) v) then
    raise exception 'PALLET_INVALID: duplicate batch keys' using errcode = '22023';
  end if;
  for entry in select value from jsonb_array_elements(p_slots) order by value->>'zone', value->>'slot_code' loop
    audit_meta := entry->'_audit';
    if jsonb_typeof(entry->'items') is distinct from 'array'
      or jsonb_typeof(entry->'occupied') is distinct from 'boolean'
      or jsonb_typeof(audit_meta) is distinct from 'object'
      or coalesce(length(entry->>'zone'),0) not between 1 and 100
      or coalesce(length(entry->>'slot_code'),0) not between 1 and 100
      or coalesce(entry->>'expected_version','') !~ '^[0-9]+$'
      or coalesce(length(btrim(audit_meta->>'actor')),0) not between 1 and 100
      or coalesce(length(btrim(audit_meta->>'document_no')),0) not between 1 and 200
      or coalesce(audit_meta->>'action','') not in ('receive','issue','return','transfer','adjust','remove','import') then
      raise exception 'PALLET_INVALID: operator, document and action required' using errcode = '22023';
    end if;
    perform pg_catalog.set_config('app.pallet_audit_meta', audit_meta::text, true);
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
  perform pg_catalog.set_config('app.pallet_audit_meta', '', true);
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
commit;
