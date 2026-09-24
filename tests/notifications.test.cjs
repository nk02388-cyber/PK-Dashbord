const assert = require('node:assert/strict');
const test = require('node:test');
const {findLowStock,negativeStock} = require('../notifications.js');

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
