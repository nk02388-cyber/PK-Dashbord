const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../cycle-counts-core.js');

test('next count uses location frequency and handles month boundaries', () => {
  assert.equal(core.nextDue('2026-09-26', 30), '2026-10-26');
  assert.equal(core.nextDue('2026-09-26', 0), null);
  assert.equal(core.scheduleStatus('2026-09-26', 30, '2026-10-27').kind, 'overdue');
  assert.equal(core.scheduleStatus(null, 30, '2026-09-26').label, 'นับครั้งแรก');
});

test('zone snapshot keeps item units, unknown quantities and occupied slots without items', () => {
  const result = core.snapshotZone('A', [{ code: 'A-01' }, { code: 'A-02' }, { code: 'A-03' }], {
    'A-01': [{ code: 'P1', name: 'Bottle', lotNo: 'L1', unit: 'ใบ', remainingQty: 7 }, { code: 'P2', name: 'Cap', qty: null, unit: 'ชิ้น' }],
    'A-02': [{ code: 'OLD', name: 'Depleted history', remainingQty: 0, unit: 'ชิ้น' }]
  }, { 'A-02': 'occupied' }, item => item.remainingQty ?? item.qty ?? null);
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows.map(row => row.expected), [7, null, 1]);
  assert.equal(result.rows[0].lot, 'L1');
  assert.equal(result.rows[2].type, 'occupied');
});

test('count must name the counter and enter every physical result before completion', () => {
  const draft = { countedBy: '', rows: [{ slot: 'A-01', type: 'item', expected: 5, counted: '' }] };
  assert.match(core.countError(draft), /ผู้ตรวจนับ/);
  draft.countedBy = 'Somchai';
  assert.match(core.countError(draft), /A-01/);
  draft.rows[0].counted = 3;
  assert.equal(core.countError(draft), null);
  assert.deepEqual(core.countSummary(draft.rows), { counted: 1, different: 1, unknown: 0 });
  assert.match(core.countError({ countedBy: 'Somchai', rows: [], confirmEmpty: false }), /ยืนยัน/);
});
