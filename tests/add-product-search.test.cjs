const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract = name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const stock = [
  {code:'314-4-2000-55',name:'ฝาปั๊ม PP สีขาว',unit:'ฝา',wh:'202'},
  {code:'314-4-2000-55',name:'ฝาปั๊ม PP สีขาว',unit:'ฝา',wh:'800'},
  {code:'PK-NEW',name:'ขวดพิเศษ',unit:'ขวด',wh:'201'},
];
const slots = {A:{'A-01':[{code:'314-4-2000-55',name:'ฝาปั๊มเดิม',unit:'ฝา'},
  {code:'ONLY-PALLET',name:'กล่องพิเศษ',unit:'ใบ',remainingQty:0}]}};
const before = JSON.stringify({stock,slots});
const ctx = vm.createContext({STOCK:{items:stock},SLOT_ITEMS:slots});
vm.runInContext(['normalizeSearchText','getAddProductSuggestions'].map(extract).join('\n'),ctx);
assert.equal(ctx.getAddProductSuggestions('314-4')[0].code,'314-4-2000-55');
assert.equal(ctx.getAddProductSuggestions('314-4').length,1,'Multiple warehouses and pallet copies share one suggestion');
assert.equal(ctx.getAddProductSuggestions('ฝาปั๊ม')[0].unit,'ฝา');
assert.equal(ctx.getAddProductSuggestions('ขวดพิเศษ')[0].code,'PK-NEW','Suggest stock catalog items absent from pallets');
assert.equal(ctx.getAddProductSuggestions('กล่องพิเศษ')[0].code,'ONLY-PALLET','Suggest pallet items with no active balance');
assert.equal(ctx.getAddProductSuggestions('ขวดพิเศษ')[0].source,'สต็อก');
assert.equal(ctx.getAddProductSuggestions('ไม่พบ').length,0);
assert.equal(JSON.stringify({stock,slots}),before,'Suggestions never alter source records');
assert.match(html,/id="fseAddCode"[^>]*role="combobox"[^>]*aria-controls="fseAddSuggestions"/);
assert.match(html,/fseAddCode\.addEventListener\('keydown'/);
assert.match(html,/selectAddProductSuggestion\(addSuggestionItems\[Number\(option\.dataset\.index\)\]\)/);
console.log('PASS: add-product code/name suggestions include stock and pallet catalog, deduplicate, rank and preserve drafts');
