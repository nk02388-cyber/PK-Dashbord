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
  const stored=[JSON.parse(original),{code:'OTHER',qty:7}];
  const state={zone:'K',slot:'K-04',itemIndex:0,snapshot:JSON.stringify(stored[0]),version:4};
  const candidate=edit(stored[0],'withdraw',0,200,'2026-08-25');
  let payload;
  const env=vm.createContext({palletWriteBusy:false,slotItemsFor:()=>stored,
    buildSlotRow:()=>({zone:'K',slot_code:'K-04',occupied:true,items:stored}),
    savePalletBatch:async rows=>{payload=rows}});
  vm.runInContext(extract('movementMatchesSnapshot')+'\n'+extract('persistMovementEdit'),env);
  await env.persistMovementEdit(state,candidate);
  assert.equal(payload[0].expected_version,4);
  assert.equal(payload[0].items[0].remainingQty,4270);
  assert.equal(payload[0].items[1].code,'OTHER');
  assert.equal(stored[0].remainingQty,4170,'No optimistic mutation');
  env.savePalletBatch=async()=>{throw Error('conflict')};
  await assert.rejects(env.persistMovementEdit(state,candidate),/conflict/);
  assert.equal(env.palletWriteBusy,false);
  assert.equal(stored[0].remainingQty,4170);
  stored[0].qty=1;
  await assert.rejects(env.persistMovementEdit(state,candidate),/แก้ไขแล้ว/);
}
testPersist().then(()=>console.log('PASS: movement calculations, validation, immutable drafts and versioned persistence'))
  .catch(error=>{console.error(error);process.exitCode=1});