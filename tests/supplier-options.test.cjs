const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {cleanName, forProduct} = require('../supplier-options.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'supplier-options-data.js'), 'utf8');
const options = JSON.parse(source.match(/const PK_SUPPLIER_OPTIONS = (\{.*\});/)[1]);

test('supplier choices match workbook counts and product codes', () => {
  assert.equal(Object.keys(options).length, 560);
  assert.equal(Object.values(options).reduce((sum, names) => sum + names.length, 0), 591);
  assert.equal(forProduct('311-1-0108-5501', options).length, 3);
  assert.deepEqual(forProduct('missing', options), []);
});

test('suggestions contain names without company and head-office suffixes', () => {
  assert.equal(cleanName('บริษัท สายสี่คาร์ตัน จำกัด'), 'สายสี่คาร์ตัน');
  assert.equal(cleanName('บริษัท เอ็น.พี.พี. เปเปอร์ แอนด์ เทรดดิ้ง จำกัด (สำนักงานใหญ่)'), 'เอ็น.พี.พี. เปเปอร์ แอนด์ เทรดดิ้ง');
  assert.equal(cleanName('Hangzhou Green Packaging Co.,Ltd.'), 'Hangzhou Green Packaging');
  for (const names of Object.values(options)) {
    for (const name of names.map(cleanName)) {
      assert.ok(name);
      assert.doesNotMatch(name, /^บริษัท\s|\sจำกัด$|สำนักงานใหญ่/);
    }
  }
});
