-- Run once in the existing Supabase project's SQL Editor.
-- The stock snapshot remains unchanged; this read-only RPC adds its database save time.
create or replace function public.get_latest_stock_inventory()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select stock_data || jsonb_build_object('snapshot_saved_at', created_at)
  from public.stock_inventory_snapshots
  order by id desc
  limit 1;
$$;

revoke all on function public.get_latest_stock_inventory() from public;
grant execute on function public.get_latest_stock_inventory() to anon, authenticated;
