const test = require('node:test');
const assert = require('node:assert/strict');
const {parseReceiptPlanSheet, sheetNameForDate} = require('../receipt-plan.js');

test('daily plan resolves the exact workbook tab for a selected date', () => {
  assert.equal(sheetNameForDate('2026-09-17'), '17.09');
  assert.equal(sheetNameForDate('invalid'), '');
});

test('daily plan reads shifted headers, repeated company marks and separate quantities', () => {
  const rows = parseReceiptPlanSheet([
    ['', 'บรรจุภัณฑ์ -PK 17/09/2026'],
    ['', 'ลำดับ', 'RR No.(WH)', 'ชื่อบริษัท', 'ช่วงเวลา', 'PO', 'รหัสสินค้า', 'รายการ', 'จำนวน', 'หน่วย'],
    ['', 1, '', 'บริษัท ก จำกัด', 'เช้า', 'PO001', '31-100', 'ขวด A', '1,200', 'ขวด'],
    ['', 2, '', '"', '"', 'PO002', '31-200', 'ฝา B', 600, 'ชิ้น'],
    ['', 3, '', '', '', '', '', 'ไม่มีรายการ', '', ''],
    ['', 4, '', '', '', '', '', '', '', '']
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.code,row.company,row.period,row.quantity,row.unit]), [
    ['31-100','บริษัท ก จำกัด','เช้า',1200,'ขวด'],
    ['31-200','บริษัท ก จำกัด','เช้า',600,'ชิ้น']
  ]);
});

test('daily plan rejects unexpected source columns', () => {
  assert.throws(() => parseReceiptPlanSheet([['สินค้า','จำนวน']]), /ไม่พบหัวตาราง/);
  assert.throws(() => parseReceiptPlanSheet([['PO','รหัสสินค้า'],['PO1','31-1']]), /คอลัมน์แผนรับเข้าไม่ครบ/);
});
