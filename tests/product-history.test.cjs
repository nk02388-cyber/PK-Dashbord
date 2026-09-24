const assert = require('node:assert/strict');
const test = require('node:test');
const {buildCatalog, searchCatalog, collectMovements, summarizeStock, summarizeQuantities} = require('../product-history.js');

const stock = [
  {code:'31-0001', name:'ขวด JABS Lotion', search_name:'ขวด โลชั่น', wh:'201', unit:'ขวด', qty:20},
  {code:'31-0001', name:'ขวด JABS Lotion', wh:'202', unit:'ขวด', qty:12},
  {code:'31-0002', name:'ฝา JABS', wh:'201', unit:'ชิ้น', qty:5},
];
const pallets = {A:{'A-01':[
  {code:'31-0001', name:'ขวด JABS Lotion', lotNo:'LOT-1'},
  {code:'OLD-01', name:'สินค้าเก่า', lotNo:'LOT-2'},
]}};

test('searches latest stock and pallet records by code, name and keyword', () => {
  const catalog = buildCatalog(stock, pallets);
  assert.equal(catalog.length, 3);
  assert.deepEqual(searchCatalog(catalog,'31-0001').map(row => row.code),['31-0001']);
  assert.deepEqual(searchCatalog(catalog,'โลชั่น').map(row => row.code),['31-0001']);
  assert.deepEqual(searchCatalog(catalog,'jabs ขวด').map(row => row.code),['31-0001']);
  assert.deepEqual(searchCatalog(catalog,'สินค้าเก่า').map(row => row.code),['OLD-01']);
  assert.deepEqual(searchCatalog(catalog,'missing'),[]);
});

test('combines real pallet movements in date order and retains their location', () => {
  const rows = collectMovements(pallets,'31-0001', () => ({rows:[
    {date:'31/08/2026',label:'รับเข้า',type:'receive',qty:20},
    {date:'2026-09-02',label:'เบิก',type:'withdraw',qty:4},
  ]}));
  assert.deepEqual(rows.map(row => row.label),['เบิก','รับเข้า']);
  assert.equal(rows[0].zone,'A');
  assert.equal(rows[0].slot,'A-01');
  assert.equal(rows[0].lotNo,'LOT-1');
  assert.deepEqual(collectMovements(pallets,'31-0002',() => ({rows:[]})),[]);
});

test('summarizes current balances separately by warehouse and unit', () => {
  assert.deepEqual(summarizeStock(stock,'31-0001').map(({wh,qty}) => [wh,qty]),[['201',20],['202',12]]);
});

test('summarizes receipts, returns, issues and current balance without counting transfers', () => {
  const movements = [
    {type:'receive',qty:20,unit:'ขวด'},
    {type:'return',qty:3,unit:'ขวด'},
    {type:'withdraw',qty:8,unit:'ขวด'},
    {type:'transfer_out',qty:5,unit:'ขวด'},
    {type:'transfer_in',qty:5,unit:'ขวด'},
    {type:'move',qty:0,unit:'ขวด'},
  ];
  const [total] = summarizeQuantities(movements,summarizeStock(stock,'31-0001'));
  assert.equal(total.received,23);
  assert.equal(total.issued,8);
  assert.equal(total.balance,32);
  assert.equal(total.hasHistory,true);
  assert.equal(total.hasStock,true);
});

test('keeps different units separate and marks unknown quantities', () => {
  const totals = summarizeQuantities([
    {type:'receive',qty:10,unit:'ขวด'},
    {type:'withdraw',qty:null,unit:'ขวด'},
    {type:'receive',qty:2,unit:'กล่อง'},
  ],[{unit:'ขวด',qty:4,known:true},{unit:'กล่อง',qty:0,known:false}]);
  const bottles = totals.find(row => row.unit === 'ขวด');
  const boxes = totals.find(row => row.unit === 'กล่อง');
  assert.equal(bottles.received,10);
  assert.equal(bottles.issuedKnown,false);
  assert.equal(boxes.received,2);
  assert.equal(boxes.balanceKnown,false);
  assert.equal(summarizeQuantities([],[]).length,0);
});
