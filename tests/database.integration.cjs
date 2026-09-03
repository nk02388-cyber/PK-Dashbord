// Opt-in integration test. Called by a local PostgreSQL runner; never accepts a remote target.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=async function runDatabaseIntegration({Client,connection}) {
  assert.ok(['127.0.0.1','localhost','::1'].includes(connection.host),'Local database required');
  assert.match(connection.database,/^codex_test_/);
  const admin=new Client(connection);await admin.connect();const clients=[];
  const report={checks:[],findings:[]};
  const pass=(s)=>report.checks.push(s);
  try {
    await admin.query(`create role anon; create role authenticated; create schema extensions;
      create extension pgcrypto with schema extensions; create publication supabase_realtime;`);
    await admin.query(fs.readFileSync(path.join(__dirname,'..','supabase-pallet.sql'),'utf8'));
    await admin.query(fs.readFileSync(path.join(__dirname,'..','supabase-stock.sql'),'utf8'));
    // Schema/policies are loaded from the repository and were compared with the live catalog.
    for(const [user,role] of [['qa_user_a','authenticated'],['qa_user_b','authenticated'],['qa_guest','anon']]) {
      await admin.query(`create role ${user} login password 'local-test-only'; grant ${role} to ${user};`);
      const client=new Client({...connection,user,password:'local-test-only'});await client.connect();clients.push(client);
    }
    const [a,b,guest]=clients;
    const original={code:'QA-STOCK',name:'Synthetic integration item',unit:'ใบ',qty:20,remainingQty:15,
      receiveDate:'2026-09-01',withdrawals:[{qty:5,date:'2026-09-02',unit:'ใบ',by:'QA'}]};
    await a.query(`insert into public.pallet_slots(zone,slot_code,occupied,items,updated_at)
      values('QA','QA-01',true,$1,'2000-01-01T00:00:00Z')`,[JSON.stringify([original])]);
    assert.equal((await b.query("select items from public.pallet_slots where zone='QA'")).rows.length,1);
    pass('Two separate authenticated database accounts can read the shared synthetic slot');
    for(const client of [a,b,guest]) {
      await assert.rejects(client.query('select * from public.stock_inventory_settings'),e=>e.code==='42501');
      await assert.rejects(client.query('select * from public.stock_inventory_snapshots'),e=>e.code==='42501');
      await assert.rejects(client.query("delete from public.pallet_slots where zone='QA'"),e=>e.code==='42501');
    }
    pass('anon/authenticated direct PIN-table, snapshot-table and DELETE access denied');
    await guest.query(`insert into public.receive_dates(item_code,receive_date) values('QA-GUEST','2026-09-01')`);
    await guest.query(`update public.receive_dates set receive_date='2026-09-02' where item_code='QA-GUEST'`);
    await guest.query(`insert into public.pallet_slots(zone,slot_code,items) values('QA','QA-GUEST','[]')`);
    await guest.query(`update public.pallet_slots set occupied=true where zone='QA' and slot_code='QA-GUEST'`);
    report.findings.push('Current production-equivalent policies allow unauthenticated pallet and receive-date inserts/updates. Authentication/role separation is not enforced.');
    const pin='test-pin-only';
    await admin.query("update public.stock_inventory_settings set pin_hash=extensions.crypt($1,extensions.gen_salt('bf'))",[pin]);
    const args=['Test date','Synthetic test',JSON.stringify([{code:'QA',name:'Synthetic',unit:'ใบ',qty:20,value:20,wh:'200',cat:'Test'}])];
    await assert.rejects(guest.query('select public.replace_stock_inventory($1,$2,$3,$4)',[...args,'wrong-test-pin']),/Invalid Update PIN/);
    assert.equal((await admin.query('select count(*)::int n from public.stock_inventory_snapshots')).rows[0].n,0);
    await guest.query('select public.replace_stock_inventory($1,$2,$3,$4)',[...args,pin]);
    assert.equal((await admin.query('select count(*)::int n from public.stock_inventory_snapshots')).rows[0].n,1);
    pass('Wrong PIN rejects a write without adding a snapshot; synthetic correct PIN creates one snapshot');
    const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
    const extract=n=>html.match(new RegExp(`(?:async )?function ${n}\\([^]*?\\n\\}`))[0];
    const source=['movementMatchesSnapshot','formatMovementDate','getRemainingQty','movementNumber','movementDateKey',
      'getStockMovement','prepareMovementEdit','persistMovementEdit'].map(extract).join('\n');
    let waiting=0,release;const barrier=new Promise(r=>release=r);
    function adapter(client) {return {from(table){
      assert.equal(table,'pallet_slots');const filters=[];let update=null;
      const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},
        update(v){update=v;return q},async maybeSingle(){
          const parameters=[];const where=filters.map(([k,v])=>{
            assert.ok(['zone','slot_code','updated_at'].includes(k));if(v===null)return `${k} is null`;
            parameters.push(v);return `${k}=$${parameters.length}`;
          }).join(' and ');
          try {
            let result;
            if(update) {
              parameters.push(JSON.stringify(update.items),update.updated_at);
              result=await client.query(`update public.pallet_slots set items=$${parameters.length-1},updated_at=$${parameters.length} where ${where} returning *`,parameters);
            } else {
              result=await client.query(`select * from public.pallet_slots where ${where}`,parameters);
              if(++waiting===2)release();await barrier;
            }
            return {data:result.rows[0]||null,error:null};
          }catch(error){return {data:null,error};}
        }};return q;
    }};}
    function userContext(client) {
      const local=[JSON.parse(JSON.stringify(original))];
      const ctx=vm.createContext({supabaseClient:adapter(client),slotItemsFor:()=>local,
        applyRemoteSlotRow(row){local.splice(0,local.length,...row.items);}});
      vm.runInContext(source,ctx);return ctx;
    }
    const ca=userContext(a),cb=userContext(b);
    const edit={zone:'QA',slot:'QA-01',itemIndex:0,snapshot:JSON.stringify(original)};
    const nextA=ca.prepareMovementEdit(original,'receive',0,{qty:21,date:'2026-09-01',lotNo:'QA',by:'User A'});
    const nextB=cb.prepareMovementEdit(original,'receive',0,{qty:22,date:'2026-09-01',lotNo:'QA',by:'User B'});
    const outcomes=await Promise.allSettled([ca.persistMovementEdit(edit,nextA),cb.persistMovementEdit(edit,nextB)]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(o=>o.status==='rejected').length,1);
    assert.match(String(outcomes.find(o=>o.status==='rejected').reason),/พร้อมกัน/);
    const saved=(await admin.query("select items from public.pallet_slots where zone='QA' and slot_code='QA-01'")).rows[0].items[0];
    assert.ok([21,22].includes(saved.qty));assert.equal(saved.remainingQty,saved.qty-5);
    assert.equal(saved.movementEdits.length,1);assert.equal(saved.withdrawals.length,1);
    pass('Actual application movement persistence with two concurrent PostgreSQL sessions: exactly one writer succeeds, the stale writer is rejected, balance/history/audit remain consistent');
    // Reproduce the limitation in legacy whole-row writes as an explicit finding, not a pass.
    const before=(await a.query("select items from public.pallet_slots where zone='QA' and slot_code='QA-01'")).rows[0].items;
    const first=JSON.parse(JSON.stringify(before)),second=JSON.parse(JSON.stringify(before));
    first[0].note='User A';second[0].note='User B';
    await a.query("update public.pallet_slots set items=$1 where zone='QA' and slot_code='QA-01'",[JSON.stringify(first)]);
    await b.query("update public.pallet_slots set items=$1 where zone='QA' and slot_code='QA-01'",[JSON.stringify(second)]);
    report.findings.push('Legacy whole-slot writes without an updated_at condition remain last-write-wins; only STOCK CARD movement edits currently reject stale concurrent writes.');
    return report;
  } finally {await Promise.allSettled(clients.map(c=>c.end()));await admin.end();}
};
