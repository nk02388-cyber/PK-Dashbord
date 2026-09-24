const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {evaluate,counts,searchRows} = require('../reorder-points.js');

const data = fs.readFileSync(path.join(__dirname,'..','reorder-points-data.js'),'utf8');
const points = JSON.parse(data.match(/const PK_ROP_DATA = (\[.*\]);/)[1]);

test('imports all reviewed workbook ROP rows with code and unit', () => {
  assert.equal(points.length,978);
  assert.equal(new Set(points.map(row => row.code)).size,978);
  assert.ok(points.every(row => row.code && row.unit && Number.isFinite(row.rop) && row.rop > 0));
});

test('compares current eligible stock only in the same unit and excludes held stock', () => {
  const rules = [
    {code:'A',name:'ขวด A',unit:'ขวด',rop:100,pattern:'สม่ำเสมอ',historyWeeks:38},
    {code:'B',name:'กล่อง B',unit:'ใบ',rop:50,pattern:'เป็นช่วง',historyWeeks:20},
    {code:'C',name:'สินค้าเฉพาะรุ่น',unit:'ชิ้น',rop:100,pattern:'นานๆ ครั้ง',historyWeeks:38},
    {code:'D',name:'ข้อมูลน้อย',unit:'ชิ้น',rop:100,pattern:'สม่ำเสมอ',historyWeeks:4},
    {code:'E',name:'ไม่พบหน่วย',unit:'ชุด',rop:10,pattern:'สม่ำเสมอ',historyWeeks:38},
  ];
  const stock = [
    {code:'A',unit:'ขวด',wh:'200',qty:30},{code:'A',unit:'ขวด',wh:'202',qty:40},
    {code:'A',unit:'ขวด',wh:'800',qty:1000},{code:'A',unit:'กล่อง',wh:'201',qty:100},
    {code:'B',unit:'ใบ',wh:'202',qty:80},
    {code:'C',unit:'ชิ้น',wh:'201',qty:0},
    {code:'D',unit:'ชิ้น',wh:'201',qty:5},
    {code:'E',unit:'ชิ้น',wh:'201',qty:1},
  ];
  const rows = evaluate(rules,stock);
  assert.deepEqual(rows.map(row => row.status),['alert','normal','review','review','unmatched']);
  assert.equal(rows[0].available,70);
  assert.equal(rows[0].gap,30);
  assert.deepEqual(counts(rows),{alert:1,review:2,normal:1,unmatched:1});
  assert.deepEqual(searchRows(rows,'ขวด','alert').map(row => row.code),['A']);
});

test('unknown quantity and excluded-only warehouses cannot trigger order alerts', () => {
  const point = {code:'X',unit:'ขวด',rop:10,pattern:'สม่ำเสมอ',historyWeeks:38};
  assert.equal(evaluate([point],[{code:'X',unit:'ขวด',wh:'201',qty:null}])[0].status,'unmatched');
  assert.equal(evaluate([point],[{code:'X',unit:'ขวด',wh:'900',qty:2}])[0].status,'unmatched');
});
