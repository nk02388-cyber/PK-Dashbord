const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../scrap-inventory-core.js');

const details = { qty: '3', date: '2026-09-26', reason: 'ชำรุด', document: 'SP-001', actor: 'Nida', note: 'กล่องเปียก' };

test('scrap reduces only the selected pallet balance and keeps a traceable movement', () => {
  const item = { code: 'PK-1', name: 'กล่อง', lotNo: 'L-42', unit: 'ใบ', qty: 10, remainingQty: 8, withdrawals: [{ qty: 2 }] };
  const next = core.prepare(item, details, '2026-09-26T10:00:00.000Z');
  assert.equal(next.remainingQty, 5);
  assert.equal(item.remainingQty, 8);
  assert.equal(next.withdrawals.length, 1);
  assert.deepEqual(next.scraps[0], { date: '2026-09-26', qty: 3, unit: 'ใบ', lotNo: 'L-42', reason: 'ชำรุด', note: 'กล่องเปียก', by: 'Nida', reference: 'SP-001', destination: 'Inventory Loss / Scrap', recordedAt: '2026-09-26T10:00:00.000Z' });
});

test('scrap rejects missing balance, excessive or invalid quantity, and missing audit fields', () => {
  const item = { code: 'PK-1', unit: 'ใบ', remainingQty: 4 };
  assert.match(core.validate({ code: 'PK-1' }, details), /ยอดคงเหลือ/);
  assert.match(core.validate(item, { ...details, qty: '5' }), /ไม่เกิน/);
  assert.match(core.validate(item, { ...details, qty: '-1' }), /มากกว่า 0/);
  assert.match(core.validate(item, { ...details, reason: '' }), /เหตุผล/);
  assert.match(core.validate(item, { ...details, document: '' }), /เอกสาร/);
  assert.match(core.validate(item, { ...details, actor: '' }), /ผู้ทำรายการ/);
  assert.throws(() => core.prepare(item, { ...details, qty: '5' }), /ไม่เกิน/);
});
