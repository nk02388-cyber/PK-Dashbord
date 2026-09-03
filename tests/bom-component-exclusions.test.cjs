const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/function recalculateBomFromStock\([^]*?\n\}/)[0];
const makeContext = (bom, stock) => vm.createContext({
  BOMPK: bom, STOCK: stock, fgBomSearch: { value: '' },
  renderBomSummary() {}, renderFgBom() {},
});
const line = (pk_code, qty_per_unit = 1) => ({ pk_code, qty_per_unit });
const bom = { assumptions: { excluded_warehouses: ['800', '900'] }, kpis: {}, bom_detail: {
  FG: { lines: [line('51-0021-002/1'), line(' 5999 '), line(5001), line('315-01', 2)] },
  EMPTY: { lines: [line('51-only')] },
  HOLD: { lines: [line('31-hold')] },
  UNKNOWN: { lines: [line('31-unknown', null)] },
} };
const stock = { items: [
  { code: '315-01', wh: '200', qty: 20, value: 100 },
  { code: '315-01', wh: '800', qty: 100, value: 500 },
  { code: '31-hold', wh: '900', qty: 50, value: 50 },
  { code: '51-0021-002/1', wh: '200', qty: 0, value: 0 },
] };
const stockBefore = JSON.stringify(stock);
const ctx = makeContext(bom, stock);
vm.runInContext(source, ctx);
ctx.recalculateBomFromStock();
assert.deepEqual(Array.from(bom.bom_detail.FG.lines, l => l.pk_code), ['315-01']);
assert.equal(bom.bom_detail.FG.producible, 10, 'Excluded missing stock must not block production');
assert.equal(bom.bom_detail.FG.bottleneck_code, '315-01');
assert.equal(bom.bom_detail.FG.line_count, 1);
assert.equal(bom.bom_detail.EMPTY.lines.length, 0);
assert.equal(bom.bom_detail.EMPTY.producible, null, 'An empty BOM must not imply production readiness');
assert.equal(bom.bom_detail.EMPTY.bottleneck_code, null);
assert.equal(bom.bom_detail.UNKNOWN.producible, null);
assert.equal(bom.bom_detail.HOLD.producible, 0, 'Hold/reject warehouses stay excluded');
assert.equal(bom.kpis.total_fg_with_bom, 3);
assert.equal(bom.kpis.total_bom_lines, 3);
assert.equal(bom.kpis.unique_components, 3);
assert.equal(bom.kpis.fg_available, 1);
assert.equal(bom.kpis.fg_blocked, 1);
assert.equal(JSON.stringify(stock), stockBefore, 'Stock inventory must remain unchanged');
const once = JSON.stringify(bom);
ctx.recalculateBomFromStock();
assert.equal(JSON.stringify(bom), once, 'Repeated refresh must preserve counts');
ctx.STOCK = { items: [{ code: '315-01', wh: '200', qty: 6, value: 30 }] };
ctx.recalculateBomFromStock();
assert.equal(bom.bom_detail.FG.producible, 3, 'A new stock snapshot must recalculate retained components');

// Run the same production code against every embedded BOM, including the KOTA example.
const data = JSON.parse(html.match(/^const DATA = (.*);$/m)[1]);
const originalBom = JSON.parse(JSON.stringify(data.bomPk));
const real = makeContext(data.bomPk, data.stock);
vm.runInContext(source, real);
real.recalculateBomFromStock();
for (const [code, detail] of Object.entries(data.bomPk.bom_detail)) {
  const expected = originalBom.bom_detail[code].lines.filter(l => !String(l.pk_code).trim().startsWith('5'));
  assert.deepEqual(Array.from(detail.lines, l => l.pk_code), expected.map(l => l.pk_code));
  assert.equal(detail.line_count, expected.length);
  assert.ok(!String(detail.bottleneck_code || '').startsWith('5'));
}
assert.equal(data.bomPk.bom_detail['21-0021-06'].line_count, 6);
assert.ok(data.bomPk.bom_detail['21-0021-06'].producible > 0);
assert.equal(data.bomPk.kpis.total_bom_lines, 3375);
assert.equal(data.bomPk.kpis.unique_components, 1524);
assert.equal(data.bomPk.kpis.total_fg_with_bom, 756);
console.log('PASS: prefix-5 BOM removal, readiness, counts, empty formulas, stock refresh and all embedded formulas');
