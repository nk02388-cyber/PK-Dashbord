const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source = html.match(/async function fetchAllPalletRows\([^]*?\n\}/)[0];
const ctx = vm.createContext({}); vm.runInContext(source,ctx);
function client(rows, mode='ok') {
  let calls=0; const orders=[];
  return {orders,get calls(){return calls},from(table){return {
    select(_,options){assert.equal(options.count,'exact');return this},
    order(key){orders.push(key);return this},
    async range(start,end){calls++;return {
      data:mode==='missing'&&calls>1?[]:mode==='duplicate'&&calls>1?[rows[0]]:rows.slice(start,end+1),
      count:mode==='count-change'&&calls>1?rows.length+1:rows.length,
      error:mode==='error'?new Error('Network failed'):null,
    }}
  }}};
}
(async()=>{
  for(const size of [0,1,500,1000,1001,1507]){
    const rows=Array.from({length:size},(_,i)=>({zone:'F',slot_code:String(i)}));
    const mock=client(rows); const result=await ctx.fetchAllPalletRows(mock,'pallet_slots');
    assert.equal(result.length,size); assert.equal(mock.calls,Math.max(1,Math.ceil(size/500)));
    assert.deepEqual(mock.orders.slice(0,2),['zone','slot_code']);
  }
  const dates=client([{item_code:'X'}]);
  assert.equal((await ctx.fetchAllPalletRows(dates,'receive_dates')).length,1);
  assert.deepEqual(dates.orders,['item_code']);
  const rows=Array.from({length:1001},(_,i)=>({zone:'F',slot_code:String(i)}));
  for(const mode of ['missing','duplicate','count-change','error']) await assert.rejects(ctx.fetchAllPalletRows(client(rows,mode),'pallet_slots'));
  await assert.rejects(ctx.fetchAllPalletRows(client([]),'stock_inventory_settings'),/Unsupported/);
  assert.match(html,/const SUPABASE_URL = 'https:\/\/zgsxbuckjrplkpvtlbmn.supabase.co'/);
  assert.doesNotMatch(html,/ddumrwpkpgfrkocwcruz/);
  assert.match(html,/\? supabaseClient : window.supabase.createClient/);
  console.log('PASS: complete paginated pallet loading, 1001+ rows, error/count/duplicate guards and shared target client');
})().catch(error=>{console.error(error);process.exitCode=1});
