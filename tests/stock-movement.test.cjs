const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const names = ['formatMovementDate','getRemainingQty','movementNumber','movementDateKey','getStockMovement','prepareMovementEdit','updateSlotItem'];
const extract = name => html.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0];
const ctx = vm.createContext({SLOT_ITEMS:{K:{'K-04':[]}},syncSlotToRemote(){}});
vm.runInContext(names.map(extract).join('\n'),ctx);
const sample = {code:'TEST',qty:8645,receiveDate:'2026-08-08',unit:'ใบ',lotNo:'2608-0113',remainingQty:4170,
  withdrawals:[{date:'2026-08-25',qty:300,unit:'ใบ',by:'L-6'},{date:'2026-08-27',qty:4175,unit:'ใบ',by:'L-6'}]};
const original = JSON.stringify(sample);
assert.deepEqual(Array.from(ctx.getStockMovement(sample).rows,r=>r.balance),[8645,8345,4170]);
const edit = (item,type,index,qty,date) => ctx.prepareMovementEdit(item,type,index,{qty,date,lotNo:'NEW',by:'Tester'});
let next=edit(sample,'withdraw',0,200,'2026-08-25');
assert.equal(next.remainingQty,4270);
assert.equal(next.withdrawals[1].qty,4175);
assert.equal(next.movementEdits[0].before.qty,300);
assert.equal(next.movementEdits[0].after.qty,200);
assert.equal(JSON.stringify(sample),original);
next=edit(sample,'receive',0,9000,'2026-08-08');
assert.equal(next.remainingQty,4525);
const returned={...sample,returns:[{date:'2026-08-26',qty:100,unit:'ใบ'}],remainingQty:4270};
assert.deepEqual(Array.from(ctx.getStockMovement(returned).rows,r=>r.balance),[8645,8345,8445,4270]);
next=edit(returned,'return',0,200,'2026-08-26');
assert.equal(next.remainingQty,4370);
assert.throws(()=>edit(sample,'receive',0,100,'2026-08-08'),/ติดลบ/);
assert.throws(()=>edit(sample,'withdraw',0,-1,'2026-08-25'),/จำนวน/);
assert.throws(()=>edit(sample,'withdraw',0,NaN,'2026-08-25'),/จำนวน/);
assert.throws(()=>edit(sample,'withdraw',0,0,'2026-08-25'),/จำนวน/);
assert.throws(()=>edit(sample,'withdraw',0,200,'2026-02-30'),/วันที่/);
assert.throws(()=>edit(sample,'receive',0,9000,'2026-09-01'),/ระหว่างรายการ/);
assert.throws(()=>edit(returned,'return',0,5000,'2026-08-26'),/ยอดรับคืนรวม/);
assert.throws(()=>edit(returned,'return',0,100,'2026-08-01'),/ก่อนหน้า/);
assert.throws(()=>edit(returned,'withdraw',0,50,'2026-08-25'),/ก่อนหน้า/);
assert.throws(()=>edit(returned,'return',5,100,'2026-08-26'),/ไม่พบรายการ/);
assert.equal(ctx.getStockMovement({...sample,remainingQty:0}).mismatch,true);
const unknown={code:'OLD',withdrawals:[{date:'2026-08-10',qty:5,unit:'ใบ'}]};
assert.equal(ctx.getStockMovement(unknown).computed,null);
assert.throws(()=>edit(unknown,'withdraw',0,10,'2026-08-10'),/ยอดรับเข้า/);
next=edit(unknown,'receive',0,100,'2026-08-01');
assert.equal(next.remainingQty,95);
assert.equal(ctx.getStockMovement({qty:0}).computed,0);
assert.equal(ctx.getStockMovement({qty:100,unit:'ใบ',withdrawals:[{qty:1,unit:'กล่อง'}]}).computed,null);
ctx.SLOT_ITEMS.K['K-04']=[returned];
assert.equal(ctx.updateSlotItem('K','K-04',0,{...returned,qty:9000}),true);
assert.equal(returned.remainingQty,4625,'Generic item edit must include returns');
const saved=JSON.stringify(returned);
assert.equal(ctx.updateSlotItem('K','K-04',0,{...returned,qty:1}),false);
assert.equal(JSON.stringify(returned),saved,'Invalid edit must not mutate anything');

async function testPersist(){
  const item={...sample};
  const stored=[item,{code:'OTHER',qty:7}];
  const editState={zone:'K',slot:'K-04',itemIndex:0,snapshot:JSON.stringify(item)};
  const candidate=edit(item,'withdraw',0,200,'2026-08-25');
  let mode='ok',writes=0,payload,filters=[],applied;
  const client={from(){let update=false;return {
    select(){return this},eq(k,v){filters.push([k,v]);return this},is(){return this},
    update(values){update=true;payload=values;return this},
    async maybeSingle(){
      if(mode==='error')return {error:new Error('Network failure')};
      if(update){writes++;return {data:mode==='race'?null:{zone:'K',slot_code:'K-04',items:payload.items}}}
      const remoteItems = mode==='stale' ? [{...item,qty:1}] : mode==='reordered'
        ? [Object.fromEntries(Object.entries(item).reverse()),stored[1]] : stored;
      return {data:{items:remoteItems,updated_at:'VERSION-1'}};
    }
  }}};
  const env=vm.createContext({supabaseClient:client,slotItemsFor:()=>stored,applyRemoteSlotRow:row=>applied=row});
  vm.runInContext(extract('movementMatchesSnapshot')+'\n'+extract('persistMovementEdit'),env);
  await env.persistMovementEdit(editState,candidate);
  assert.equal(writes,1);
  assert.equal(applied.items[0].remainingQty,4270);
  assert.equal(applied.items[1].code,'OTHER');
  assert.ok(filters.some(([key,value])=>key==='updated_at'&&value==='VERSION-1'));
  assert.equal(item.remainingQty,4170,'Local data is not mutated before confirmed save');
  mode='reordered'; await env.persistMovementEdit(editState,candidate);
  assert.equal(writes,2,'JSONB object key order must not prevent a valid save');
  mode='error'; await assert.rejects(env.persistMovementEdit(editState,candidate),/Network failure/);
  mode='stale'; await assert.rejects(env.persistMovementEdit(editState,candidate),/เปลี่ยนแล้ว/);
  mode='race'; await assert.rejects(env.persistMovementEdit(editState,candidate),/พร้อมกัน/);
  env.supabaseClient=null;
  assert.equal(await env.persistMovementEdit(editState,candidate),false);
  assert.equal(stored[0].remainingQty,4270);
}
testPersist().then(()=>console.log('PASS: movement running balances, all edit types, audit, validation, mismatch, unknowns, save failure and concurrent writes'))
  .catch(error=>{console.error(error);process.exitCode=1});
