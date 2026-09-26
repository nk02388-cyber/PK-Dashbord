-- Apply in the existing Supabase project after creating the sole Admin auth user.
-- Passwords are stored only by Supabase Auth and never in this migration.
begin;

alter table public.app_users add column if not exists active boolean not null default true;
update public.app_users set role = 'user', active = false,
  username = 'legacy-disabled-' || left(id::text, 8)
where role = 'admin' and email <> 'admin@bcl-wms.local';
insert into public.app_users (id, username, email, role)
select id, 'Admin', email, 'admin'
from auth.users where email = 'admin@bcl-wms.local'
on conflict (id) do update set username = excluded.username, email = excluded.email, role = 'admin', active = true;

do $$ begin
  if (select count(*) from public.app_users where role = 'admin') <> 1 then
    raise exception 'Exactly one Admin account is required';
  end if;
end $$;
create unique index if not exists app_users_one_admin on public.app_users ((role)) where role = 'admin';

-- A deleted user must lose database access even while its JWT has not expired.
create or replace function public.is_app_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_users p where p.id = (select auth.uid()) and p.active and p.role in ('admin','user'));
$$;
revoke all on function public.is_app_user() from public, anon, authenticated;
grant execute on function public.is_app_user() to authenticated;

drop policy if exists app_users_read on public.app_users;
create policy app_users_read on public.app_users for select to authenticated using (id = (select auth.uid()));
revoke all on public.app_users from anon;
revoke insert, update, delete on public.app_users from authenticated;
grant select on public.app_users to authenticated;

-- Shared WMS data is visible only to active app accounts.
drop policy if exists event_calendar_read on public.event_calendar;
create policy event_calendar_read on public.event_calendar for select to authenticated using (public.is_app_user());
drop policy if exists incoming_pallets_read on public.incoming_pallets;
create policy incoming_pallets_read on public.incoming_pallets for select to authenticated using (public.is_app_user());
drop policy if exists pallet_audit_read on public.pallet_audit_log;
create policy pallet_audit_read on public.pallet_audit_log for select to authenticated using (public.is_app_user());
drop policy if exists pallet_read on public.pallet_slots;
create policy pallet_read on public.pallet_slots for select to authenticated using (public.is_app_user());
drop policy if exists receive_read on public.receive_dates;
create policy receive_read on public.receive_dates for select to authenticated using (public.is_app_user());
revoke all on public.event_calendar, public.incoming_pallets, public.pallet_audit_log,
  public.pallet_slots, public.receive_dates from anon;

-- Restrict the existing security-definer RPCs as well as their table policies.
do $$
declare routine record; original text; guarded text; definition text;
begin
  for routine in
    select p.oid, p.proname, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'save_pallet_changes', 'create_incoming_pallet', 'create_incoming_batch',
      'putaway_incoming_pallet', 'save_calendar_event', 'delete_calendar_event',
      'replace_stock_inventory')
  loop
    original := routine.prosrc;
    guarded := regexp_replace(original, '\mbegin\M',
      E'begin\n  if not public.is_app_user() then raise exception ''APP_FORBIDDEN: active account required'' using errcode = ''42501''; end if;', 'i');
    if guarded = original then raise exception 'Could not guard RPC %', routine.proname; end if;
    definition := pg_get_functiondef(routine.oid);
    if strpos(definition, original) = 0 then raise exception 'Could not rebuild RPC %', routine.proname; end if;
    execute replace(definition, original, guarded);
  end loop;
end $$;

create or replace function public.get_latest_stock_inventory()
returns jsonb language sql stable security definer set search_path = '' as $$
  select stock_data from public.stock_inventory_snapshots
  where public.is_app_user() order by id desc limit 1;
$$;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.get_latest_stock_inventory() to authenticated;
notify pgrst, 'reload schema';
commit;
