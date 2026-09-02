-- Migration target: zgsxbuckjrplkpvtlbmn. Creates new tables only.
-- No changes to stock_inventory_snapshots, stock_inventory_settings or Stock RPCs.
-- Intentionally fail if either target table already exists; never overwrite existing data.
create table public.pallet_slots (
  zone text not null,
  slot_code text not null,
  occupied boolean not null default false,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (zone, slot_code)
);
create table public.receive_dates (
  item_code text primary key,
  receive_date date,
  updated_at timestamptz not null default now()
);

alter table public.pallet_slots enable row level security;
alter table public.receive_dates enable row level security;
revoke all on public.pallet_slots, public.receive_dates from public, anon, authenticated;
-- Preserve the source app's browser access model, limited to these two new tables.
-- Public read/insert/update; no browser DELETE or access to Stock/PIN tables.
grant select, insert, update on public.pallet_slots, public.receive_dates to anon, authenticated;
create policy pallet_read on public.pallet_slots for select to anon, authenticated using (true);
create policy pallet_insert on public.pallet_slots for insert to anon, authenticated with check (true);
create policy pallet_update on public.pallet_slots for update to anon, authenticated using (true) with check (true);
create policy receive_read on public.receive_dates for select to anon, authenticated using (true);
create policy receive_insert on public.receive_dates for insert to anon, authenticated with check (true);
create policy receive_update on public.receive_dates for update to anon, authenticated using (true) with check (true);
alter publication supabase_realtime add table public.pallet_slots, public.receive_dates;
notify pgrst, 'reload schema';
