const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract=n=>html.match(new RegExp(`function ${n}\\([^]*?\\n\\}`))[0];
const ctx=vm.createContext({BOM_UNIT_ALIASES:{pcs:'pcs',ชิ้น:'pcs',kg:'kg'}});
vm.runInContext(html.match(/const RECONCILE_EXCLUDED_WAREHOUSES = [^\n]+/)[0],ctx);
for(const n of ['normalizeBomUnit','movementNumber','getRemainingQty','buildStockReconciliation','filterStockReconciliation','stockReconciliationTables'])vm.runInContext(extract(n),ctx);
const stock=[{code:' a ',name:'Updated',unit:'ชิ้น',qty:10,wh:'201'},{code:'A',unit:'pcs',qty:5,wh:'202'},
  {code:'B',unit:'kg',qty:3,wh:'201'},{code:'C',unit:'pcs',qty:null,wh:'201'},{code:'D',unit:'pcs',qty:0,wh:'201'},
  ...['200','800','900','300-S','300'].map(wh=>({code:'A',unit:'pcs',qty:100,wh})),
  {code:'E',unit:'pcs',qty:2,wh:'800'},{code:'EXCLUDED-ONLY',unit:'pcs',qty:1,wh:'900'}];
const pallets=[{zone:'F',slot_code:'F-01',items:[{code:'A',name:'Pallet',unit:'pcs',remainingQty:12},{code:'B',unit:'pcs',remainingQty:3},{code:'E',unit:'pcs',remainingQty:2},{code:'C',unit:'pcs'}]}];
const pcs=ctx.normalizeBomUnit('pcs'),kg=ctx.normalizeBomUnit('kg');
const rows=ctx.buildStockReconciliation(stock,pallets),by=(code,unit)=>rows.find(r=>r.code===code&&r.unit===unit);
assert.equal(by('A',pcs).stock,15);assert.equal(by('A',pcs).pallet,12);assert.equal(by('A',pcs).difference,-3);assert.equal(by('A',pcs).status,'ยอดไม่ตรง');
assert.equal(by('A',pcs).warehouses.join(','),'201,202');
assert.equal(by('E',pcs).status,'ไม่มีในสต็อกที่อัปเดต');
assert.equal(rows.some(r=>r.code==='EXCLUDED-ONLY'),false);
assert.equal(by('B',kg).status,'ไม่มีในพาเลต');assert.equal(by('B',pcs).status,'ไม่มีในสต็อกที่อัปเดต');
assert.equal(by('C',pcs).status,'ต้องตรวจสอบ');assert.equal(by('C',pcs).difference,null);
assert.equal(by('D',pcs).status,'ไม่มีในพาเลต');assert.equal(by('E',pcs).status,'ไม่มีในสต็อกที่อัปเดต');
assert.equal(ctx.filterStockReconciliation(rows,'different').length,rows.length);
assert.equal(ctx.filterStockReconciliation(rows,'mismatch').length,1);
assert.equal(ctx.filterStockReconciliation(rows,'missing_pallet').length,2);
const tables=ctx.stockReconciliationTables(rows,{exportedAt:'now',stockDate:'date',stockStatus:'latest'});
assert.equal(tables.length,2);assert.equal(tables[1].rows.length,rows.length+1);assert.match(tables[0].rows.find(r=>r[0]==='ส่วนต่าง')[1],/พาเลต/);
assert.match(tables[0].rows.find(r=>r[0]==='ขอบเขตสต็อกที่อัปเดต')[1],/200, 800, 900 และ 300-S/);
assert.match(html,/สต็อกที่อัปเดตไม่นับคลัง 200, 800, 900 และ 300-S/);
assert.equal(stock[0].qty,10);assert.equal(pallets[0].items[0].remainingQty,12);
console.log('PASS: stock/pallet reconciliation excludes 200, 800, 900 and 300-S; grain, aliases, statuses, filters and export');
