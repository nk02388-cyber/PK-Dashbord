-- Phase 1: install application identities and guarded RPCs before deploying the UI.
-- The existing Supabase Auth account is the sole application administrator.
begin;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  role text not null check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);
create unique index if not exists app_users_one_admin on public.app_users(role) where role = 'admin';
alter table public.app_users enable row level security;
revoke all on public.app_users from public, anon, authenticated;
grant select on public.app_users to authenticated;

create or replace function public.is_app_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_users where id = auth.uid());
$$;
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_users where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_app_user() from public, anon;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_user(), public.is_app_admin() to authenticated;

drop policy if exists app_users_read on public.app_users;
create policy app_users_read on public.app_users for select to authenticated
using (id = auth.uid() or public.is_app_admin());

insert into public.app_users(id, username, email, role)
select id, 'Admin', email, 'admin' from auth.users
where id = 'd8c53d9d-7501-419a-9598-a36861102510'::uuid
  and email is not null
on conflict (id) do update set username = excluded.username, email = excluded.email, role = excluded.role;

do $$ begin
  if (select count(*) from public.app_users where role = 'admin') <> 1 then
    raise exception 'Expected exactly one application admin';
  end if;
end $$;

create or replace function public.app_save_pallet_changes(p_slots jsonb default '[]', p_dates jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_user() then raise exception 'Login required' using errcode = '42501'; end if;
  return public.save_pallet_changes(p_slots, p_dates);
end $$;
create or replace function public.app_get_latest_stock_inventory()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_user() then raise exception 'Login required' using errcode = '42501'; end if;
  return public.get_latest_stock_inventory();
end $$;
create or replace function public.app_replace_stock_inventory(p_report_date text, p_source_name text, p_items jsonb, p_update_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return public.replace_stock_inventory(p_report_date, p_source_name, p_items, p_update_pin);
end $$;
revoke all on function public.app_save_pallet_changes(jsonb,jsonb) from public, anon;
revoke all on function public.app_get_latest_stock_inventory() from public, anon;
revoke all on function public.app_replace_stock_inventory(text,text,jsonb,text) from public, anon;
grant execute on function public.app_save_pallet_changes(jsonb,jsonb),
  public.app_get_latest_stock_inventory(),
  public.app_replace_stock_inventory(text,text,jsonb,text) to authenticated;

notify pgrst, 'reload schema';
commit;
