-- Run via SQL admin in one transaction. All fixtures and writes are rolled back.
begin;
do $$
declare test_user uuid := gen_random_uuid(); result jsonb; rejected boolean;
begin
  insert into auth.users(id,email,email_confirmed_at,is_anonymous)
    values(test_user,'pallet-regression@example.invalid',now(),false);
  perform set_config('request.jwt.claim.sub',test_user::text,true);
  if public.can_edit_pallets() then raise exception 'Unlisted account got access'; end if;
  rejected := false;
  begin perform public.save_pallet_changes('[]','[]');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Unlisted write accepted'; end if;
  insert into public.pallet_editors(email) values ('pallet-regression@example.invalid');
  if not public.can_edit_pallets() then raise exception 'Confirmed editor denied'; end if;
  result := public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":false,"items":[],"expected_version":0}]','[]');
  if result->'slots'->0->>'version' <> '1' then raise exception 'Insert version incorrect'; end if;
  result := public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":true,"items":[],"expected_version":1}]','[]');
  if result->'slots'->0->>'version' <> '2' then raise exception 'Update version incorrect'; end if;
  rejected := false;
  begin perform public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":false,"items":[],"expected_version":1}]','[]');
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'Stale slot write accepted'; end if;
  rejected := false;
  begin perform public.save_pallet_changes('[{"zone":"__REGRESSION__","slot_code":"A","occupied":false,"items":[],"expected_version":2},{"zone":"__REGRESSION__","slot_code":"B","occupied":false,"items":[],"expected_version":99}]','[]');
  exception when serialization_failure then rejected := true; end;
  if not rejected or (select version from public.pallet_slots where zone='__REGRESSION__' and slot_code='A') <> 2 then
    raise exception 'Partial import committed'; end if;
  result := public.save_pallet_changes('[]','[{"item_code":"__REGRESSION__","receive_date":"2026-09-05","expected_version":0}]');
  rejected := false;
  begin perform public.save_pallet_changes('[]','[{"item_code":"__REGRESSION__","receive_date":"2026-09-06","expected_version":0}]');
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'Date creation race accepted'; end if;
  update auth.users set email_confirmed_at=null where id=test_user;
  if public.can_edit_pallets() then raise exception 'Unconfirmed account accepted'; end if;
  update auth.users set email_confirmed_at=now(),is_anonymous=true where id=test_user;
  if public.can_edit_pallets() then raise exception 'Anonymous auth account accepted'; end if;
end $$;
rollback;
select 'PASS: editor restriction, version increments, stale writes, atomic rollback, receive-date race, unconfirmed and anonymous accounts' as result;
