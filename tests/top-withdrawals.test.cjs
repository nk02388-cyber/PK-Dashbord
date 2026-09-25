const assert = require('node:assert/strict');
const test = require('node:test');
const {dateKey, summarizeTopWithdrawals} = require('../top-withdrawals.js');

const pallets = {
  A:{'A-01':[
    {code:'SKU-1',name:'ขวด A',unit:'ขวด',withdrawals:[
      {date:'2026-09-10',qty:100,unit:'ขวด'},
      {date:'25/09/2569',qty:20,unit:'ขวด'},
      {date:'2026-08-01',qty:50,unit:'ขวด'},
      {date:'2026-09-26',qty:999,unit:'ขวด'},
    ],returns:[{date:'2026-09-20',qty:90,unit:'ขวด'}],transfersOut:[{date:'2026-09-20',qty:500,unit:'ขวด'}]},
    {code:'SKU-2',name:'กล่อง B',unit:'กล่อง',withdrawals:[{date:'2026-09-20',qty:200,unit:'กล่อง'}]},
  ]},
  B:{'B-01':[
    {code:'sku-1',name:'ขวด A',unit:'ขวด',withdrawals:[{date:'2026-09-24',qty:30,unit:'ขวด'}]},
    {code:'SKU-3',name:'ขวด C',unit:'ขวด',withdrawals:[{date:'2026-09-23',qty:40,unit:'ขวด'},{date:'2026-09-22',qty:0,unit:'ขวด'},{date:'',qty:900,unit:'ขวด'}]},
  ]},
};

test('normalizes real movement dates and rejects invalid dates', () => {
  assert.equal(dateKey('25/09/2569'),'2026-09-25');
  assert.equal(dateKey('25/09/69'),'2026-09-25');
  assert.equal(dateKey('2026-09-25'),'2026-09-25');
  assert.equal(dateKey('31/09/2026'),null);
});

test('ranks actual withdrawals by SKU within one unit and a 30-day window', () => {
  const result = summarizeTopWithdrawals(pallets,{asOf:'2026-09-25',days:30,unit:'ขวด'});
  assert.equal(result.unit,'ขวด');
  assert.equal(result.transactions,4);
  assert.deepEqual(result.rows.map(row => [row.code,row.qty,row.transactions]),[
    ['SKU-1',150,3],['SKU-3',40,1],
  ]);
  assert.deepEqual(result.units.map(row => row.name),['ขวด','กล่อง']);
});

test('keeps units separate and excludes returns, moves, invalid quantities, and future dates', () => {
  const boxes = summarizeTopWithdrawals(pallets,{asOf:'2026-09-25',days:30,unit:'กล่อง'});
  assert.deepEqual(boxes.rows.map(row => [row.code,row.qty]),[['SKU-2',200]]);
  const week = summarizeTopWithdrawals(pallets,{asOf:'2026-09-25',days:7,unit:'ขวด'});
  assert.deepEqual(week.rows.map(row => [row.code,row.qty]),[['SKU-1',50],['SKU-3',40]]);
  const all = summarizeTopWithdrawals(pallets,{asOf:'2026-09-25',days:'all',unit:'ขวด'});
  assert.equal(all.rows[0].qty,200);
});

test('reports empty periods without inventing use', () => {
  const result = summarizeTopWithdrawals(pallets,{asOf:'2026-07-01',days:7});
  assert.deepEqual(result.rows,[]);
  assert.deepEqual(result.units,[]);
});
