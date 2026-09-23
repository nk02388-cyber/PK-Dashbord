-- Apply once in the same Supabase project as pallet_slots, after supabase-pallet-audit.sql.
-- FM-ST-011 records arrival. FM-ST-019 identifies each pallet until a location is scanned.
begin;
create extension if not exists pgcrypto;
create table if not exists public.incoming_locations (
  zone text not null,
  slot_code text not null,
  primary key (zone,slot_code)
);
insert into public.incoming_locations(zone,slot_code)
select g.zone,g.prefix||lpad(n::text,g.width,'0')
from (values
  ('A','A-',2,34),
  ('A-1','A1-',2,35),
  ('B','B-',2,24),
  ('B-1','B1-',2,35),
  ('C','C-',2,24),
  ('C-1','C1-',2,35),
  ('D','D-',2,24),
  ('D-1','D1-',2,35),
  ('E','E-',2,24),
  ('E-1','E1-',2,34),
  ('F','F-',2,36),
  ('F-1','F1-',2,35),
  ('G','G-',2,16),
  ('G-1','G1-',2,35),
  ('H','H-',2,24),
  ('H-1','H1-',2,34),
  ('I','I-',2,24),
  ('I-1','I1-',2,12),
  ('J','J-',2,48),
  ('J-1','J1-',2,12),
  ('K','K-',2,24),
  ('K-1','K1-',2,12),
  ('L','L-',2,24),
  ('L-1','L1-',2,20),
  ('M','M-',2,24),
  ('M-1','M1-',2,22),
  ('N','N-',2,12),
  ('N-1','N1-',2,23),
  ('O','O-',2,24),
  ('O-1','O1-',2,24),
  ('P','P-',2,24),
  ('P-1','P1-',2,24),
  ('Q','Q-',2,24),
  ('Q-1','Q1-',2,24),
  ('R','R-',2,24),
  ('R-1','R1-',2,23),
  ('S','S-',2,12),
  ('S-1','S1-',2,14),
  ('T','T-',2,19),
  ('U','U-',2,24)
) as g(zone,prefix,width,last_no)
cross join lateral generate_series(1,g.last_no) n
on conflict do nothing;
alter table public.incoming_locations enable row level security;
revoke all on public.incoming_locations from public, anon, authenticated;
create table if not exists public.incoming_pallets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  receiving_no text not null,
  running_no integer not null check (running_no > 0),
  supplier_name text not null,
  product_code text not null,
  product_name text not null,
  lot_no text not null default '',
  unit text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  received_on date not null,
  manufactured_on date,
  expires_on date,
  received_by text not null,
  received_at timestamptz not null default clock_timestamp(),
  status text not null default 'pending' check (status in ('pending','stored')),
  zone text,
  slot_code text,
  stored_by text,
  stored_at timestamptz,
  unique (receiving_no,running_no),
  check ((status = 'pending' and zone is null and slot_code is null and stored_at is null)
      or (status = 'stored' and zone is not null and slot_code is not null and stored_at is not null))
);
create index if not exists incoming_pallets_status_idx on public.incoming_pallets(status,received_at desc);
alter table public.incoming_pallets enable row level security;
revoke all on public.incoming_pallets from public, anon, authenticated;
grant select on public.incoming_pallets to anon, authenticated;
drop policy if exists incoming_pallets_read on public.incoming_pallets;
create policy incoming_pallets_read on public.incoming_pallets for select to anon, authenticated using (true);

create or replace function public.create_incoming_pallet(
  p_receiving_no text,p_supplier_name text,p_product_code text,p_product_name text,
  p_lot_no text,p_unit text,p_quantity numeric,p_received_on date,
  p_manufactured_on date,p_expires_on date,p_actor text,p_request_id uuid
) returns public.incoming_pallets language plpgsql security definer set search_path = '' as $$
declare row_out public.incoming_pallets;
  document_no text := upper(btrim(coalesce(p_receiving_no,'')));
begin
  if p_request_id is null or length(document_no) not between 1 and 80 or length(btrim(coalesce(p_supplier_name,''))) not between 1 and 200
    or length(btrim(coalesce(p_product_code,''))) not between 1 and 100
    or length(btrim(coalesce(p_product_name,''))) not between 1 and 500
    or length(btrim(coalesce(p_unit,''))) not between 1 and 80
    or length(btrim(coalesce(p_actor,''))) not between 1 and 100
    or length(coalesce(p_lot_no,'')) > 120 or p_quantity is null or p_quantity <= 0
    or p_received_on is null or (p_manufactured_on is not null and p_expires_on is not null and p_expires_on < p_manufactured_on) then
    raise exception 'INCOMING_INVALID: required receipt or pallet information is missing' using errcode='22023';
  end if;
  -- Serialize running numbers for one FM-ST-011 document, even across devices.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(document_no,0));
  select * into row_out from public.incoming_pallets where request_id=p_request_id;
  if found then return row_out; end if;
  insert into public.incoming_pallets
    (request_id,receiving_no,running_no,supplier_name,product_code,product_name,lot_no,unit,quantity,
     received_on,manufactured_on,expires_on,received_by)
  values (p_request_id,document_no,(select coalesce(max(running_no),0)+1 from public.incoming_pallets where receiving_no=document_no),
    btrim(p_supplier_name),upper(btrim(p_product_code)),btrim(p_product_name),btrim(coalesce(p_lot_no,'')),
    btrim(p_unit),p_quantity,p_received_on,p_manufactured_on,p_expires_on,btrim(p_actor)) returning * into row_out;
  return row_out;
end;
$$;
revoke all on function public.create_incoming_pallet(text,text,text,text,text,text,numeric,date,date,date,text,uuid) from public,anon,authenticated;
grant execute on function public.create_incoming_pallet(text,text,text,text,text,text,numeric,date,date,date,text,uuid) to anon,authenticated;

create or replace function public.putaway_incoming_pallet(
  p_tag_id uuid,p_zone text,p_slot text,p_actor text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare tag public.incoming_pallets; saved_slot public.pallet_slots;
  zone_code text := upper(btrim(coalesce(p_zone,'')));
  slot_code text := upper(btrim(coalesce(p_slot,'')));
  item jsonb;
begin
  if p_tag_id is null or length(zone_code) not between 1 and 20 or length(slot_code) not between 1 and 40
    or slot_code !~ '^[A-Z][A-Z0-9-]*$' or length(btrim(coalesce(p_actor,''))) not between 1 and 100 then
    raise exception 'INCOMING_INVALID: tag, location and operator are required' using errcode='22023';
  end if;
  if not exists (select 1 from public.incoming_locations where zone=zone_code and slot_code=slot_code) then
    raise exception 'INCOMING_INVALID: unknown location' using errcode='22023';
  end if;
  select * into tag from public.incoming_pallets where id=p_tag_id for update;
  if not found then raise exception 'INCOMING_NOT_FOUND: pallet tag does not exist' using errcode='P0002'; end if;
  if tag.status <> 'pending' then raise exception 'INCOMING_ALREADY_STORED: pallet tag was already stored' using errcode='23505'; end if;
  item := pg_catalog.jsonb_build_object(
    'inboundTagId',tag.id,'code',tag.product_code,'name',tag.product_name,'lotNo',tag.lot_no,
    'receiveDate',tag.received_on,'receivedAt',tag.received_at,'receiveReference',tag.receiving_no,
    'receivedBy',tag.received_by,'qty',tag.quantity,'remainingQty',tag.quantity,'unit',tag.unit,
    'manufacturedOn',tag.manufactured_on,'expiresOn',tag.expires_on,'supplierName',tag.supplier_name,
    'withdrawals',pg_catalog.jsonb_build_array());
  perform pg_catalog.set_config('app.pallet_audit_meta',
    pg_catalog.jsonb_build_object('action','receive','actor',btrim(p_actor),'document_no',tag.receiving_no)::text,true);
  insert into public.pallet_slots(zone,slot_code,occupied,items)
    values(zone_code,slot_code,true,pg_catalog.jsonb_build_array(item)) on conflict do nothing returning * into saved_slot;
  if not found then
    update public.pallet_slots set items=items||pg_catalog.jsonb_build_array(item),occupied=true,
      version=version+1,updated_at=clock_timestamp()
      where zone=zone_code and slot_code=slot_code returning * into saved_slot;
  end if;
  update public.incoming_pallets set status='stored',zone=zone_code,slot_code=slot_code,
    stored_by=btrim(p_actor),stored_at=clock_timestamp() where id=tag.id returning * into tag;
  perform pg_catalog.set_config('app.pallet_audit_meta','',true);
  return pg_catalog.jsonb_build_object('tag',to_jsonb(tag),'slot',to_jsonb(saved_slot));
end;
$$;
revoke all on function public.putaway_incoming_pallet(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.putaway_incoming_pallet(uuid,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
