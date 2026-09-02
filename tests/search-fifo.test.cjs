const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const names = ['formatMovementDate', 'sortSearchMatchesFifo', 'renderSearchMatches', 'rebuildItemToSlots', 'getRemainingQty', 'movementNumber'];
const source = names.map(name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0]).join('\n');
const items = [{zone:'D',slot:'D-16',name:'สินค้า',receiveDate:'2026-09-01'},
  {zone:'D',slot:'D-21',name:'สินค้า',receiveDate:'2026-08-04'},
  {zone:'C',slot:'C-05',name:'สินค้า',receiveDate:'2026-08-01',lotNo:'<LOT>'},
  {zone:'C',slot:'C-06',name:'สินค้า',receiveDate:'2026-08-04'}];
const before = JSON.stringify(items);
const ctx = vm.createContext({floorplanSearchMsg:{dataset:{}}, jumpToSlot:(zone,slot)=>ctx.jump=[zone,slot],
  SLOT_ITEMS:{F:{'F-01':[{code:'X',name:'Test',qty:5,receiveDate:'2026-08-01',lotNo:'LOT'}]}},ITEM_TO_SLOTS:{},
  escapeHtml:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')});
vm.runInContext(source,ctx);
const slots = list => Array.from(ctx.sortSearchMatchesFifo(list), x=>x.slot);
assert.deepEqual(slots(items),['C-05','D-21','C-06','D-16']);
assert.equal(JSON.stringify(items),before,'Do not reorder source records');
assert.deepEqual(slots([{slot:'unknown'}, {slot:'bad',receiveDate:'2026-02-30'},
  {slot:'later',receiveDate:'01/01/2027'}, {slot:'earlier',receiveDate:'2026-12-31'}]),
  ['earlier','later','unknown','bad']);
ctx.renderSearchMatches(items,'X');
const result=ctx.floorplanSearchMsg.innerHTML;
assert.equal((result.match(/class="fs-jump"/g)||[]).length,4);
assert.deepEqual([...result.matchAll(/data-slot="([^"]+)"/g)].map(m=>m[1]),['C-05','D-21','C-06','D-16']);
assert.match(result,/รับ 01\/08\/2026/);
assert.match(result,/Lot: &lt;LOT>/);
assert.match(result,/class="fs-fifo-list"/);
ctx.renderSearchMatches([items[0]],'X');
assert.deepEqual(ctx.jump,['D','D-16']);
ctx.renderSearchMatches([],'X');
assert.match(ctx.floorplanSearchMsg.innerHTML,/ไม่พบตำแหน่ง/);
ctx.rebuildItemToSlots();
assert.equal(ctx.ITEM_TO_SLOTS.X[0].receiveDate,'2026-08-01');
assert.equal(ctx.ITEM_TO_SLOTS.X[0].lotNo,'LOT');
assert.match(html,/\.fs-fifo-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
console.log('PASS: FIFO oldest-first, stable ties, undated-last, four button rows, lot/date labels and unchanged source data');
