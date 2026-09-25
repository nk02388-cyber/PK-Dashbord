const assert = require('node:assert/strict');
const test = require('node:test');
const {findLowStock,negativeStock,stockPalletMismatch,dayKey,actionSignature,restoredDismissals,visibleActions} = require('../notifications.js');

test('stock and pallet alert counts only quantity mismatches and flags differing snapshot times', () => {
  const rows = [
    {code:'A',unit:'ขวด',status:'ยอดไม่ตรง',difference:-5},
    {code:'B',unit:'ขวด',status:'ไม่มีในพาเลต'},
    {code:'C',unit:'ชิ้น',status:'ตรงกัน'},
    {code:'D',unit:'ใบ',status:'ยอดไม่ตรง',difference:12},
  ];
  const alert = stockPalletMismatch(rows,'พาเลตแก้หลังบันทึกสต็อก 2 ตำแหน่ง');
  assert.equal(alert.count,2);
  assert.equal(alert.example.code,'A');
  assert.equal(alert.differentTimes,true);
  assert.equal(stockPalletMismatch(rows,'ยังยืนยันเวลาตัดยอดร่วมกันไม่ได้').differentTimes,false);
  assert.equal(stockPalletMismatch([{code:'C',status:'ตรงกัน'}],''),null);
});

test('low-stock alert needs a per-product minimum and sums all warehouses in the same unit', () => {
  const data = [
    {code:'A',name:'ขวด A',unit:'ขวด',wh:'201',qty:25,min_qty:50},
    {code:'A',name:'ขวด A',unit:'ขวด',wh:'202',qty:20},
    {code:'B',unit:'ชิ้น',qty:1},
    {code:'C',unit:'กล่อง',qty:0,min_qty:2},
    {code:'D',unit:'ขวด',qty:-2,min_qty:10},
  ];
  const result = findLowStock(data);
  assert.equal(result.configured,3);
  assert.deepEqual(result.rows.map(row => [row.code,row.qty,row.minimum]),[['C',0,2],['A',45,50]]);
  assert.deepEqual(negativeStock(data).map(row => row.code),['D']);
});

test('unknown balances are not reported as low stock', () => {
  assert.deepEqual(findLowStock([{code:'A',unit:'ชิ้น',qty:null,min_qty:20}]).rows,[]);
  assert.deepEqual(findLowStock([{code:'A',unit:'ชิ้น',qty:4}]).rows,[]);
});

test('cleared alerts stay hidden today, changed alerts reappear, and a new day resets them', () => {
  const day = dayKey(new Date(2026,8,24,23,59));
  const tomorrow = dayKey(new Date(2026,8,25,0,1));
  const pending = {kind:'pending',title:'9 พาเลตรอจัดเก็บ',detail:'รหัส A'};
  const changed = {...pending,title:'10 พาเลตรอจัดเก็บ'};
  const signature = actionSignature(pending);
  const saved = JSON.stringify({day,signatures:[signature]});
  assert.deepEqual(visibleActions([pending,changed],restoredDismissals(saved,day)),[changed]);
  assert.deepEqual(visibleActions([pending],restoredDismissals(saved,tomorrow)),[pending]);
  assert.equal(restoredDismissals('invalid',day).size,0);
});
