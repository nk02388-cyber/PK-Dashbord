-- Shared appointment calendar for BCL WMS. Apply once in the existing Supabase project.
-- The site currently allows public pallet edits; calendar writes follow that access model.
begin;

create extension if not exists pgcrypto;
create table if not exists public.event_calendar (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 1 and 120),
  event_date date not null,
  event_time time without time zone not null,
  lead_minutes integer not null default 1440 check (lead_minutes in (0,15,60,1440,10080)),
  details text not null default '' check (length(details) <= 500),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists event_calendar_date_idx on public.event_calendar (event_date,event_time);
alter table public.event_calendar enable row level security;
revoke all on public.event_calendar from public,anon,authenticated;
grant select on public.event_calendar to anon,authenticated;
drop policy if exists event_calendar_read on public.event_calendar;
create policy event_calendar_read on public.event_calendar for select to anon,authenticated using (true);

create or replace function public.save_calendar_event(
  p_id uuid,p_name text,p_date date,p_time time without time zone,
  p_lead integer,p_details text,p_expected_version bigint
) returns public.event_calendar language plpgsql security definer set search_path = '' as $$
declare saved public.event_calendar;
begin
  if p_id is null or length(btrim(coalesce(p_name,''))) not between 1 and 120
    or p_date is null or p_time is null or p_lead not in (0,15,60,1440,10080)
    or length(coalesce(p_details,'')) > 500 or p_expected_version is null or p_expected_version < 0 then
    raise exception 'CALENDAR_INVALID: appointment fields are invalid' using errcode='22023';
  end if;
  if p_expected_version = 0 then
    insert into public.event_calendar(id,name,event_date,event_time,lead_minutes,details)
      values(p_id,btrim(p_name),p_date,p_time,p_lead,coalesce(p_details,''))
      on conflict do nothing returning * into saved;
  else
    update public.event_calendar set name=btrim(p_name),event_date=p_date,event_time=p_time,
      lead_minutes=p_lead,details=coalesce(p_details,''),version=version+1,updated_at=clock_timestamp()
      where id=p_id and version=p_expected_version returning * into saved;
  end if;
  if not found then raise exception 'CALENDAR_CONFLICT: appointment changed on another device' using errcode='40001'; end if;
  return saved;
end;
$$;
revoke all on function public.save_calendar_event(uuid,text,date,time without time zone,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.save_calendar_event(uuid,text,date,time without time zone,integer,text,bigint) to anon,authenticated;

create or replace function public.delete_calendar_event(p_id uuid,p_expected_version bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare deleted_id uuid;
begin
  if p_id is null or p_expected_version is null or p_expected_version < 1 then
    raise exception 'CALENDAR_INVALID: appointment id or version is invalid' using errcode='22023';
  end if;
  delete from public.event_calendar where id=p_id and version=p_expected_version returning id into deleted_id;
  if not found then raise exception 'CALENDAR_CONFLICT: appointment changed on another device' using errcode='40001'; end if;
  return deleted_id;
end;
$$;
revoke all on function public.delete_calendar_event(uuid,bigint) from public,anon,authenticated;
grant execute on function public.delete_calendar_event(uuid,bigint) to anon,authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_calendar') then
    alter publication supabase_realtime add table public.event_calendar;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
