const assert = require('node:assert/strict');
const test = require('node:test');
const {buildCatalog, searchCatalog, collectMovements, summarizeStock, summarizeBalances, stockCardRows} = require('../product-history.js');

const stock = [
  {code:'31-0001', name:'ขวด JABS Lotion', search_name:'ขวด โลชั่น', wh:'201', unit:'ขวด', qty:20},
  {code:'31-0001', name:'ขวด JABS Lotion', wh:'202', unit:'ขวด', qty:12},
  {code:'31-0002', name:'ฝา JABS', wh:'201', unit:'ชิ้น', qty:5},
];
const pallets = {A:{'A-01':[
  {code:'31-0001', name:'ขวด JABS Lotion', lotNo:'LOT-1', supplierName:'บริษัท ผู้ส่งสินค้า'},
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

test('latest supplier workbook enriches search without inventing pallet movements', () => {
  const latest = {
    '31-0001': {name:'ขวด JABS Lotion', supplier:'บริษัท ล่าสุด', receivedOn:'24/09/2569'},
    'NEW-01': {name:'สินค้าใหม่', supplier:'บริษัท อีกแห่ง', receivedOn:'23/09/2569'},
  };
  const catalog = buildCatalog(stock, pallets, latest);
  assert.deepEqual(searchCatalog(catalog,'บริษัท ล่าสุด').map(row => row.code),['31-0001']);
  const supplierOnly = searchCatalog(catalog,'NEW-01')[0];
  assert.equal(supplierOnly.name,'สินค้าใหม่');
  assert.equal(supplierOnly.fromSupplierFile,true);
  assert.equal(supplierOnly.inStock,false);
  assert.equal(supplierOnly.onPallet,false);
  assert.deepEqual(collectMovements(pallets,'NEW-01',() => ({rows:[]})),[]);
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
  assert.equal(rows[0].supplierName,'','issue rows must not be attributed to the receipt supplier');
  assert.equal(rows[1].supplierName,'บริษัท ผู้ส่งสินค้า');
  assert.deepEqual(collectMovements(pallets,'31-0002',() => ({rows:[]})),[]);
});

test('shows the latest supplier only as a marked fallback on receipt rows', () => {
  const items = {A:{'A-01':[
    {code:'X',name:'สินค้า X',lotNo:'L1'},
    {code:'X',name:'สินค้า X',lotNo:'L2',supplierName:'ผู้ส่งที่บันทึกจริง'},
  ]}};
  const rows = collectMovements(items,'X',item => ({rows:[
    {date:'2026-09-18',type:'receive',label:'รับเข้า',lotNo:item.lotNo},
    {date:'2026-09-19',type:'withdraw',label:'เบิก',lotNo:item.lotNo},
  ]}),{'X':{supplier:'ผู้ส่งล่าสุด'}});
  const fallback = rows.find(row => row.lotNo === 'L1' && row.type === 'receive');
  const recorded = rows.find(row => row.lotNo === 'L2' && row.type === 'receive');
  assert.equal(fallback.supplierName,'ผู้ส่งล่าสุด');
  assert.equal(fallback.supplierSource,'latest');
  assert.equal(recorded.supplierName,'ผู้ส่งที่บันทึกจริง');
  assert.equal(recorded.supplierSource,'recorded');
  assert.ok(rows.filter(row => row.type === 'withdraw').every(row => !row.supplierName));
});

test('summarizes current balances separately by warehouse and unit', () => {
  assert.deepEqual(summarizeStock(stock,'31-0001').map(({wh,qty}) => [wh,qty]),[['201',20],['202',12]]);
});

test('shows only current balances, keeping units separate and unknown stock explicit', () => {
  const totals = summarizeBalances([{unit:'ขวด',qty:20,known:true},{unit:'ขวด',qty:12,known:true},{unit:'กล่อง',qty:0,known:false}]);
  const bottles = totals.find(row => row.unit === 'ขวด');
  const boxes = totals.find(row => row.unit === 'กล่อง');
  assert.equal(bottles.qty,32);
  assert.equal(bottles.known,true);
  assert.equal(boxes.known,false);
  assert.deepEqual(summarizeBalances([]),[]);
});

test('stock card reverses recorded movements from the dated stock snapshot by unit', () => {
  const movements = [
    {date:'2026-09-20', type:'withdraw', qty:3, unit:'ขวด'},
    {date:'2026-09-19', type:'transfer_out', qty:2, unit:'ขวด'},
    {date:'2026-09-19', type:'transfer_in', qty:2, unit:'ขวด'},
    {date:'2026-09-18', type:'return', qty:1, unit:'ขวด'},
    {date:'2026-09-17', type:'receive', qty:7, unit:'ขวด'},
    {date:'2026-09-17', type:'receive', qty:4, unit:'กล่อง'},
  ];
  const card = stockCardRows(movements,[{unit:'ขวด',qty:10,known:true},{unit:'กล่อง',qty:4,known:true}], 'ณ วันที่: 24 ก.ย. 69');
  assert.deepEqual(card.map(row => [row.received,row.issued,row.calculatedBalance]),[
    [null,3,10],[null,2,13],[2,null,15],[1,null,13],[7,null,12],[4,null,4],
  ]);
});

test('stock card leaves balances unknown for later, undated and incomplete records', () => {
  const card = stockCardRows([
    {date:'2026-09-25',type:'receive',qty:2,unit:'ขวด'},
    {date:'2026-09-24',type:'withdraw',qty:1,unit:'ขวด'},
    {date:'2026-09-23',type:'receive',qty:null,unit:'ขวด'},
    {date:'2026-09-22',type:'receive',qty:3,unit:'ขวด'},
    {date:'',type:'receive',qty:1,unit:'ขวด'},
  ],[{unit:'ขวด',qty:5,known:true}], '24/09/2569');
  assert.deepEqual(card.map(row => row.calculatedBalance),[null,5,6,null,null]);
  assert.equal(stockCardRows([{date:'2026-09-24',type:'receive',qty:1,unit:'ชิ้น'}],[], '24/09/2569')[0].calculatedBalance,null);
});
