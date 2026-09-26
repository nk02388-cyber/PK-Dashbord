-- Use the authenticated app profile as the authoritative actor for new pallet audit rows.
-- Existing history is preserved. Run after supabase-user-login.sql.
begin;

create or replace function public.capture_pallet_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb;
  actor text;
begin
  if tg_op = 'UPDATE' and old.items = new.items and old.occupied = new.occupied then return new; end if;
  select username into actor from public.app_users
    where id = (select auth.uid()) and active and role in ('admin', 'user');
  if actor is null then
    raise exception 'APP_FORBIDDEN: active account required' using errcode = '42501';
  end if;
  meta := coalesce(nullif(pg_catalog.current_setting('app.pallet_audit_meta', true), '')::jsonb, '{}'::jsonb);
  insert into public.pallet_audit_log
    (zone,slot_code,action,actor_name,document_no,before_version,after_version,
     before_occupied,after_occupied,before_items,after_items)
  values
    (new.zone,new.slot_code,coalesce(nullif(meta->>'action',''),'adjust'),
     actor,
     coalesce(nullif(meta->>'document_no',''),'ไม่ระบุเลขเอกสาร'),
     case when tg_op = 'INSERT' then null else old.version end,new.version,
     case when tg_op = 'INSERT' then null else old.occupied end,new.occupied,
     case when tg_op = 'INSERT' then '[]'::jsonb else old.items end,new.items);
  return new;
end;
$$;

revoke all on function public.capture_pallet_audit() from public, anon, authenticated;
commit;
