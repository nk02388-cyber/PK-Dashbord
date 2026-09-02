const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract = name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const source = {F:{
  'F-01':[{code:'X',qty:10,remainingQty:0,withdrawals:[{qty:10}]}],
  'F-02':[{code:'X',qty:10,remainingQty:2,receiveDate:'2026-08-02'}],
  'F-03':[{code:'X',qty:'0.25',receiveDate:'2026-08-01'}],
  'F-04':[{code:'X',qty:0},{code:'OTHER',qty:5}],
  'F-05':[{code:'X'},{code:'X',remainingQty:-1},{code:'X',remainingQty:' '},{code:'X',remainingQty:'bad'}],
  'F-06':[],
  'F-07':[{code:'EMPTY',qty:50,remainingQty:0}],
}};
const original = JSON.stringify(source);
let jumps = 0;
const ctx = vm.createContext({SLOT_ITEMS:source,ITEM_TO_SLOTS:{},floorplanSearchMsg:{dataset:{}},
  floorplanSearchInput:{value:'X'},floorplanSearchDatalist:{},floorplanSearchSuggestions:{hidden:true},
  jumpToSlot(){jumps++},escapeHtml:v=>String(v||'')});
vm.runInContext(['getRemainingQty','movementNumber','rebuildItemToSlots','formatMovementDate',
  'sortSearchMatchesFifo','renderSearchMatches','refreshSearchDatalist',
  'normalizeSearchText','getFloorplanSearchResults'].map(extract).join('\n'),ctx);
ctx.rebuildItemToSlots();
assert.deepEqual(Array.from(ctx.ITEM_TO_SLOTS.X,e=>e.slot),['F-02','F-03']);
assert.equal(ctx.ITEM_TO_SLOTS.EMPTY,undefined);
assert.equal(ctx.getFloorplanSearchResults('EMPTY').length,0);
assert.equal(JSON.stringify(source),original,'Filtering must preserve stock records and histories');
ctx.renderSearchMatches(ctx.ITEM_TO_SLOTS.X,'X');
assert.match(ctx.floorplanSearchMsg.innerHTML,/พบ 2 รายการ/);
source.F['F-02'][0].remainingQty=0;
ctx.rebuildItemToSlots();ctx.refreshSearchDatalist();
assert.match(ctx.floorplanSearchMsg.innerHTML,/พบ 1 รายการ/);
assert.equal(jumps,0,'Refresh must not auto-open the last remaining result');
source.F['F-03'][0].remainingQty=0;
ctx.rebuildItemToSlots();ctx.refreshSearchDatalist();
assert.match(ctx.floorplanSearchMsg.innerHTML,/ไม่พบตำแหน่งที่มีสต็อกคงเหลือ/);
assert.doesNotMatch(ctx.floorplanSearchDatalist.innerHTML,/value="X"/);
source.F['F-01'][0].remainingQty=1;
ctx.rebuildItemToSlots();ctx.refreshSearchDatalist();
assert.match(ctx.floorplanSearchMsg.innerHTML,/data-slot="F-01"/,'Returned stock reappears');
assert.equal(jumps,0);
console.log('PASS: positive-stock-only search, zero/unknown/negative exclusion, partial lots, live list refresh and return reappearance');
