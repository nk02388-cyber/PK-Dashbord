-- Phase 2: apply only after the Edge Function and login UI are live and tested.
begin;
do $$ begin
  if (select count(*) from public.app_users where role = 'admin') <> 1
     or to_regprocedure('public.app_save_pallet_changes(jsonb,jsonb)') is null
     or to_regprocedure('public.app_get_latest_stock_inventory()') is null
     or to_regprocedure('public.app_replace_stock_inventory(text,text,jsonb,text)') is null then
    raise exception 'Login rollout incomplete; public access was not changed';
  end if;
end $$;

revoke all on public.pallet_slots, public.receive_dates, public.pallet_audit_log from anon;
revoke insert, update, delete on public.pallet_slots, public.receive_dates from authenticated;
grant select on public.pallet_slots, public.receive_dates, public.pallet_audit_log to authenticated;

drop policy if exists pallet_read on public.pallet_slots;
create policy pallet_read on public.pallet_slots for select to authenticated using (public.is_app_user());
drop policy if exists receive_read on public.receive_dates;
create policy receive_read on public.receive_dates for select to authenticated using (public.is_app_user());
drop policy if exists pallet_audit_read on public.pallet_audit_log;
create policy pallet_audit_read on public.pallet_audit_log for select to authenticated using (public.is_app_user());

revoke all on function public.save_pallet_changes(jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.get_latest_stock_inventory() from public, anon, authenticated;
revoke all on function public.replace_stock_inventory(text,text,jsonb,text) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
