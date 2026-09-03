const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/function renderFgBom\([^]*?\n\}/)[0];
const excluded = new Set(['31-CARTON']);
const ctx = vm.createContext({
  BOMPK: { bom_detail: { FG: { fg_name: 'Test FG', line_count: 2, lines: [
    { pk_code: '31-CARTON', unit:'ใบ', pk_name: 'Carton', qty_per_unit: 2, stock_avail: 6,
      stock_unit_value: 5, producible: 3, in_stock: true },
    { pk_code: '31-LABEL', unit:'ใบ', pk_name: 'Label', qty_per_unit: 2, stock_avail: 20,
      stock_unit_value: 1, producible: 10, in_stock: true },
  ] } } },
  fgBomResult: {}, fgBomSearchMsg: {}, fgBomSearchBtn: {},
  fgLineExclusions: { FG: excluded }, hideFgSuggestions() {},
  fmt0: n => String(Math.round(n)), fmt3: n => String(n),
  escapeHtml: s => String(s),
});
vm.runInContext(source, ctx);
const render = () => { ctx.renderFgBom('FG'); return ctx.fgBomResult.innerHTML; };
let result = render();
assert.match(result, /บรรจุภัณฑ์รองรับ 10 หน่วย FG ตามสูตร/);
const excludedRow = result.match(/<tr class="bom-excluded-row">[\s\S]*?<\/tr>/)[0];
assert.match(excludedRow, /\+6 ใบ/, 'Excluded component stock must not be consumed');
assert.match(excludedRow, /\+฿30/, 'Excluded component value must remain intact');
assert.doesNotMatch(excludedRow, /-14 ใบ|-฿70/);
assert.match(result, /aria-label="ตารางส่วนประกอบ BOM"/);
assert.match(result, /class="table-scroll fg-bom-table-wrap"[^>]*tabindex="0"/);
assert.doesNotMatch(result, /class="table-scroll fg-bom-table-wrap"[^>]*overflow:visible/);
excluded.clear();
result = render();
assert.match(result, /บรรจุภัณฑ์รองรับ 3 หน่วย FG ตามสูตร/);
assert.doesNotMatch(result, /bom-excluded-row/);
assert.match(result, /0 ใบ/, 'Restored bottleneck is consumed normally');
excluded.add('31-CARTON'); excluded.add('31-LABEL');
result = render();
assert.doesNotMatch(result, /บรรจุภัณฑ์รองรับ \d+ หน่วย FG ตามสูตร/, 'Excluding every row must not imply readiness');
assert.match(result, /\+6 ใบ/);
assert.match(result, /\+20 ใบ/);
console.log('PASS: BOM exclusion preserves stock/value, restore recalculates, empty selection and accessible table scrolling');
