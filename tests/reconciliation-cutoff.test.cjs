const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=html.match(/function reconciliationCutoff\([^]*?\n\}/)[0];
const ctx=vm.createContext({STOCK:{snapshot_saved_at:'2026-09-16T08:00:00Z'},
  palletRemoteRows:new Map([['F-01',{updated_at:'2026-09-16T09:00:00Z'}],['F-02',{updated_at:'2026-09-15T09:00:00Z'}]]),stockSnapshotState:'latest'});
vm.runInContext(fn,ctx);
assert.match(ctx.reconciliationCutoff().cutoffStatus,/แก้หลังบันทึกสต็อก 1 ตำแหน่ง/);
assert.equal(ctx.reconciliationCutoff().palletLastUpdated,'2026-09-16T09:00:00.000Z');
ctx.STOCK.snapshot_saved_at='';
assert.match(ctx.reconciliationCutoff().cutoffStatus,/ไม่มีเวลาบันทึกสต็อก/);
ctx.stockSnapshotState='fallback';
assert.match(ctx.reconciliationCutoff().cutoffStatus,/สต็อกสำรอง/);
