const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const names = ['formatMovementDate', 'getRemainingQty', 'renderSlotEdit', 'renderWithdrawForm', 'renderReturnForm'];
const source = names.map(name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0]).join('\n');
const items = [{ code: 'TEST', name: 'Test', qty: 21, unit: 'ม้วน', receiveDate: '2026-08-04',
  withdrawals: [{ date: '2026-08-26', qty: 9, unit: 'ม้วน', by: '<Tester>' }],
  returns: [{ date: '2026-09-02', qty: 3, unit: 'ม้วน' }] }];
const before = JSON.stringify(items);
const ctx = vm.createContext({
  editingSlot: { zone: 'F', slot: 'F-18' }, fseSlotTitle: {}, fseItemCount: {}, fseItemsList: {},
  FSE_ITEMS_HEADER: '', slotItemsFor: () => items, renderSlotBalance() {}, getReturnableQty: () => 6,
  editItemIndex: null, withdrawOpenIndex: null, returnOpenIndex: null, removeConfirmIndex: null,
  updateAddBtnState() {}, updateWithdrawBtnState() {}, updateReturnBtnState() {},
  escapeHtml: s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
});
vm.runInContext(source, ctx);
for (const [input, expected] of [
  ['2026-08-04', '04/08/2026'], ['2026-12-31', '31/12/2026'], ['2027-01-01', '01/01/2027'],
  ['2024-02-29', '29/02/2024'], ['2000-02-29', '29/02/2000'], ['1900-02-29', '—'],
  ['2026-02-29', '—'], ['2026-04-31', '—'], ['2026-13-01', '—'], ['2026-00-01', '—'],
  ['2026-01-00', '—'], ['0000-01-01', '—'], ['4/8/2026', '04/08/2026'],
  ['', '—'], [null, '—'], [undefined, '—'], ['invalid', '—'], ['<img>', '—'],
]) assert.equal(ctx.formatMovementDate(input), expected, String(input));
ctx.renderSlotEdit();
assert.match(ctx.fseItemsList.innerHTML, /04\/08\/2026 · รับเข้า 21 ม้วน/);
assert.match(ctx.fseItemsList.innerHTML, /26\/08\/2026 · เบิก 9 ม้วน โดย &lt;Tester>/);
assert.match(ctx.fseItemsList.innerHTML, /02\/09\/2026 · รับคืน 3 ม้วน/);
assert.doesNotMatch(ctx.fseItemsList.innerHTML, /2026-08-04|เมื่อ 2026|<Tester>/);
assert.match(ctx.renderWithdrawForm(0, items[0], 15), /<td>26\/08\/2026<\/td>/);
assert.match(ctx.renderReturnForm(0, items[0], 6), /<td>02\/09\/2026<\/td>/);
assert.equal(JSON.stringify(items), before, 'Rendering must not alter stored dates or quantities');
items.push({ code: 'DATE-ONLY', receiveDate: '2026-09-01' }, { code: 'OLD' });
ctx.renderSlotEdit();
assert.match(ctx.fseItemsList.innerHTML, /01\/09\/2026 · รับเข้า/);
assert.doesNotMatch(ctx.fseItemsList.innerHTML, /undefined|null/);
assert.match(html, /type="date" class="fe-date" value="\$\{escapeHtml\(item.receiveDate \|\| ''\)\}"/);
console.log('PASS: DD/MM/YYYY, date-first history/tables, leap dates, missing dates, escaping and unchanged ISO storage');
