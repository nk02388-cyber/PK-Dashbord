const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const extract = name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const ctx = vm.createContext({
  PALLET_STATUS: { A: { 'A-02': 'occupied' } },
  SLOT_ITEMS: { A: {
    'A-01': [{ qty: 15, remainingQty: 8 }],
    'A-02': [{ qty: 4, remainingQty: 0 }],
    'A-03': [{ qty: 4, remainingQty: 0 }],
    'A-04': [{ code: 'unknown-balance' }],
  } },
  ZONE_SLOTS: { A: ['A-01','A-02','A-03','A-04','A-05'].map(code => ({ code })) },
  AREA_BUILDINGS: [{ zones: ['A'], palletNo: 992 }],
});
for (const name of ['getRemainingQty','isOccupied','isCapacityUsed','computeAreaBuildingUsage','computeTotalCapacity']) {
  vm.runInContext(extract(name), ctx);
}

const before = JSON.stringify(ctx.SLOT_ITEMS);
assert.equal(ctx.isCapacityUsed('A','A-01'), true, 'book stock counts without an occupied flag');
assert.equal(ctx.isCapacityUsed('A','A-02'), true, 'an explicitly occupied slot still counts');
assert.equal(ctx.isCapacityUsed('A','A-03'), false, 'depleted history does not count');
assert.equal(ctx.isCapacityUsed('A','A-04'), true, 'an untracked balance is not assumed empty');
assert.equal(ctx.isCapacityUsed('A','A-05'), false, 'an empty slot does not count');
const capacity = ctx.computeTotalCapacity();
assert.equal(capacity.totalUsed, 3);
assert.equal(capacity.totalPallet, 992);
assert.equal(capacity.usedPct.toFixed(1), '0.3');
assert.equal(JSON.stringify(ctx.SLOT_ITEMS), before, 'capacity calculation does not edit stock history');
assert.match(html, /if \(!isCapacityUsed\(zoneCode, slot\.code\)\) return;/,
  'age summary and capacity use the same slot rule');
console.log('PASS: pallet capacity counts active stock, explicit occupancy and unknown balances');
