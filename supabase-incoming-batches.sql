-- Run after supabase-incoming.sql. Existing FM-ST-019 tags remain unchanged.
-- One FM-ST-011 receipt submission creates all pallet tags atomically.
begin;
alter table public.incoming_pallets add column if not exists batch_id uuid;
alter table public.incoming_pallets add column if not exists batch_index integer;
alter table public.incoming_pallets add column if not exists batch_total integer;
alter table public.incoming_pallets add column if not exists batch_total_quantity numeric(18,3);
create unique index if not exists incoming_pallets_batch_index_idx on public.incoming_pallets(batch_id,batch_index);

create or replace function public.create_incoming_batch(
  p_receiving_no text,p_supplier_name text,p_product_code text,p_product_name text,
  p_lot_no text,p_unit text,p_total_quantity numeric,p_pallet_count integer,p_quantities jsonb,
  p_received_on date,p_manufactured_on date,p_expires_on date,p_actor text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  document_no text := upper(btrim(coalesce(p_receiving_no,'')));
  existing jsonb;
  total_from_tags numeric := 0;
  pallet_qty numeric;
  next_running integer;
begin
  if p_request_id is null or length(document_no) not between 1 and 80
    or length(btrim(coalesce(p_supplier_name,''))) not between 1 and 200
    or length(btrim(coalesce(p_product_code,''))) not between 1 and 100
    or length(btrim(coalesce(p_product_name,''))) not between 1 and 500
    or length(btrim(coalesce(p_unit,''))) not between 1 and 80
    or length(btrim(coalesce(p_actor,''))) not between 1 and 100
    or length(coalesce(p_lot_no,'')) > 120
    or p_total_quantity is null or p_total_quantity <= 0
    or p_total_quantity * 1000 <> trunc(p_total_quantity * 1000)
    or p_pallet_count is null or p_pallet_count not between 1 and 100
    or p_received_on is null
    or (p_manufactured_on is not null and p_expires_on is not null and p_expires_on < p_manufactured_on)
    or coalesce(pg_catalog.jsonb_typeof(p_quantities),'') <> 'array' then
    raise exception 'INCOMING_INVALID: receipt, quantity or pallet count is invalid' using errcode='22023';
  end if;
  if pg_catalog.jsonb_array_length(p_quantities) <> p_pallet_count then
    raise exception 'INCOMING_INVALID: pallet quantity count does not match' using errcode='22023';
  end if;
  for i in 0..p_pallet_count-1 loop
    pallet_qty := (p_quantities->>i)::numeric;
    if pallet_qty is null or pallet_qty <= 0 or pallet_qty * 1000 <> trunc(pallet_qty * 1000) then
      raise exception 'INCOMING_INVALID: each pallet needs a positive quantity with up to 3 decimals' using errcode='22023';
    end if;
    total_from_tags := total_from_tags + pallet_qty;
  end loop;
  if total_from_tags <> p_total_quantity then
    raise exception 'INCOMING_INVALID: pallet quantities do not add up to total' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(document_no,0));
  select pg_catalog.jsonb_agg(to_jsonb(tag) order by tag.batch_index) into existing
    from public.incoming_pallets tag where tag.batch_id=p_request_id;
  if existing is not null then return existing; end if;
  select coalesce(max(tag.running_no),0) into next_running from public.incoming_pallets tag where tag.receiving_no=document_no;
  for i in 1..p_pallet_count loop
    pallet_qty := (p_quantities->>(i-1))::numeric;
    insert into public.incoming_pallets
      (request_id,batch_id,batch_index,batch_total,batch_total_quantity,receiving_no,running_no,
       supplier_name,product_code,product_name,lot_no,unit,quantity,received_on,
       manufactured_on,expires_on,received_by)
    values
      (gen_random_uuid(),p_request_id,i,p_pallet_count,p_total_quantity,document_no,next_running+i,
       btrim(p_supplier_name),upper(btrim(p_product_code)),btrim(p_product_name),btrim(coalesce(p_lot_no,'')),
       btrim(p_unit),pallet_qty,p_received_on,p_manufactured_on,p_expires_on,btrim(p_actor));
  end loop;
  select pg_catalog.jsonb_agg(to_jsonb(tag) order by tag.batch_index) into existing
    from public.incoming_pallets tag where tag.batch_id=p_request_id;
  return existing;
end;
$$;
revoke all on function public.create_incoming_batch(text,text,text,text,text,text,numeric,integer,jsonb,date,date,date,text,uuid) from public,anon,authenticated;
grant execute on function public.create_incoming_batch(text,text,text,text,text,text,numeric,integer,jsonb,date,date,date,text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
