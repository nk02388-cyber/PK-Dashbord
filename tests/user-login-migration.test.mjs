// Local PostgreSQL smoke test for the production access migration.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const runtime = path.resolve(root, '..', 'pg-testing');
const require = createRequire(path.join(runtime, 'package.json'));
const {default: EmbeddedPostgres} = await import(pathToFileURL(require.resolve('embedded-postgres')));
const {Client} = require('pg');
const server = new EmbeddedPostgres({databaseDir:path.join(root,'work','auth-test-'+Date.now()),
  user:'postgres',password:'local-test-only',port:55441,persistent:true,
  authMethod:'scram-sha-256',initdbFlags:['--encoding=UTF8','--locale=C'],
  postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}});
const adminId='11111111-1111-4111-8111-111111111111';
const oldId='22222222-2222-4222-8222-222222222222';
let db;
try {
  await server.initialise(); await server.start(); await server.createDatabase('codex_test_auth');
  db=new Client({host:'127.0.0.1',port:55441,database:'codex_test_auth',user:'postgres',password:'local-test-only'});
  await db.connect();
  await db.query(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key,email text unique);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.app_users(id uuid primary key,username text unique,email text unique,role text check(role in ('admin','user')));
    alter table public.app_users enable row level security;
    create policy app_users_read on public.app_users for select to authenticated using(true);
    grant select on public.app_users to authenticated;
    insert into auth.users values ('${adminId}','admin@bcl-wms.local'),('${oldId}','old@example.test');
    insert into public.app_users values ('${oldId}','Admin','old@example.test','admin');
    create table public.event_calendar(id uuid); create table public.incoming_pallets(id uuid);
    create table public.pallet_audit_log(id uuid); create table public.pallet_slots(id uuid);
    create table public.receive_dates(id uuid); create table public.stock_inventory_snapshots(id int,stock_data jsonb);
    alter table public.event_calendar enable row level security;
    alter table public.incoming_pallets enable row level security;
    alter table public.pallet_audit_log enable row level security;
    alter table public.pallet_slots enable row level security;
    alter table public.receive_dates enable row level security;
    create policy event_calendar_read on public.event_calendar for select to anon,authenticated using(true);
    create policy incoming_pallets_read on public.incoming_pallets for select to anon,authenticated using(true);
    create policy pallet_audit_read on public.pallet_audit_log for select to anon,authenticated using(true);
    create policy pallet_read on public.pallet_slots for select to anon,authenticated using(true);
    create policy receive_read on public.receive_dates for select to anon,authenticated using(true);
    grant select on public.event_calendar, public.incoming_pallets, public.pallet_audit_log,
      public.pallet_slots, public.receive_dates to anon,authenticated;
    create function public.save_calendar_event() returns text language plpgsql security definer as $$
      begin return 'ok'; end; $$;
    grant execute on function public.save_calendar_event() to anon,authenticated;`);
  await db.query(await fs.readFile(path.join(root,'supabase-user-login.sql'),'utf8'));
  const profiles=(await db.query('select username,role,active from public.app_users order by username')).rows;
  assert.deepEqual(profiles.map(p=>[p.role,p.active]),[['admin',true],['user',false]]);
  await db.query('set role anon');
  await assert.rejects(db.query('select public.save_calendar_event()'),error=>error.code==='42501');
  await db.query('reset role');
  await db.query('set role authenticated');
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',oldId]);
  await assert.rejects(db.query('select public.save_calendar_event()'),error=>error.code==='42501');
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',adminId]);
  assert.equal((await db.query('select public.save_calendar_event() value')).rows[0].value,'ok');
  console.log('PASS: one Admin, retired profile denied, anon RPC denied, Admin RPC allowed');
} finally {if(db) await db.end(); await server.stop();}
