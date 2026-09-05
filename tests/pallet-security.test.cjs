const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract=n=>html.match(new RegExp(`(?:async )?function ${n}\\([^]*?\\n\\}`))[0];
async function main(){
  let calls=0,mode='ok',sent,feedback;
  const ctx=vm.createContext({SLOT_ITEMS:{F:{'F-18':[{code:'TEST',qty:10,remainingQty:10}]}},PALLET_STATUS:{F:{'F-18':'occupied'}},
    palletCanEdit:true,palletDataReady:true,palletWriteBusy:false,palletVersions:new Map(),receiveVersions:new Map(),palletRemoteRows:new Map(),
    editingSlot:{zone:'F',slot:'F-18',version:3},slotEditPanel:{},renderOverviewSlotStatus(){},refreshAfterRemoteChange(){},
    showFseFeedback:m=>feedback=m,setSyncStatus(){},
    supabaseClient:{async rpc(name,args){calls++;sent=args;
      if(mode==='conflict')return {error:{code:'40001'}};
      if(mode==='denied')return {error:{code:'42501'}};
      if(mode==='network')return {error:{message:'network'}};
      return {data:{slots:args.p_slots.map(r=>({...r,version:r.expected_version+1})),dates:args.p_dates.map(r=>({...r,version:r.expected_version+1}))}}}}});
  for(const n of ['isOccupied','setOccupied','buildSlotRow','restoreLocalSlot','applyRemoteSlotRow','applyRemoteReceiveDateRow','savePalletBatch','runSlotMutation',
    'getRemainingQty','addSlotItem','removeSlotItem','updateSlotItem','withdrawSlotItem','returnSlotItem','syncReceiveDateToRemote','setReceiveDate'])vm.runInContext(extract(n),ctx);
  ctx.RECEIVE_DATES={};
  assert.equal(await ctx.runSlotMutation('F','F-18',()=>ctx.withdrawSlotItem('F','F-18',0,{qty:2,date:'2026-09-05',unit:'pcs',by:'tester'})),true);
  assert.equal(sent.p_slots[0].expected_version,3);assert.equal(ctx.editingSlot.version,4);assert.equal(ctx.SLOT_ITEMS.F['F-18'][0].remainingQty,8);
  const saved=JSON.stringify(ctx.SLOT_ITEMS);
  for(const fail of ['conflict','network','denied']){
    mode=fail;assert.equal(await ctx.runSlotMutation('F','F-18',()=>ctx.removeSlotItem('F','F-18',0)),false);
    assert.equal(JSON.stringify(ctx.SLOT_ITEMS),saved);assert.equal(ctx.palletWriteBusy,false);assert.ok(feedback);
  }
  mode='ok';ctx.palletCanEdit=false;const before=calls;
  assert.equal(await ctx.runSlotMutation('F','F-18',()=>ctx.setOccupied('F','F-18',false)),false);assert.equal(calls,before);
  await assert.rejects(ctx.savePalletBatch([]),/สิทธิ์/);
  ctx.palletCanEdit=true;
  ctx.applyRemoteSlotRow({zone:'F',slot_code:'F-18',version:9,occupied:true,items:[{code:'REMOTE'}]});
  assert.equal(ctx.editingSlot.version,4,'Open editor keeps its baseline');assert.equal(JSON.stringify(ctx.SLOT_ITEMS),saved,'Remote event must not silently re-target an index');
  ctx.applyRemoteSlotRow({zone:'F',slot_code:'F-18',version:8,occupied:true,items:[]});
  assert.equal(ctx.palletVersions.get('["F","F-18"]'),9,'Out-of-order realtime event ignored');
  await ctx.setReceiveDate('TEST','2026-09-05',0);assert.equal(ctx.RECEIVE_DATES.TEST,'2026-09-05');
  mode='conflict';await assert.rejects(ctx.setReceiveDate('TEST','2026-09-06',1),/คนแก้/);assert.equal(ctx.RECEIVE_DATES.TEST,'2026-09-05');
  assert.doesNotMatch(html,/\.from\('(?:pallet_slots|receive_dates)'\)\.(?:upsert|update|insert|delete)/);
  assert.match(extract('pushFullGeometryToRemote'),/savePalletBatch\(slots,dates\)/);
  console.log('PASS: authenticated writes, server versions, all-or-nothing local changes, receive dates, stale events and editor baseline');
}
main().catch(e=>{console.error(e);process.exitCode=1});
