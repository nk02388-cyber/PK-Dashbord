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
  {code:'11-0001-10',name:'ฉลากต้องตัดออก',unit:'ใบ',wh:'202'},
  {code:'21-0001-10',name:'ขวดต้องตัดออก',unit:'ขวด',wh:'202'},
  {code:'51-0001-25',name:'ซองต้องตัดออก',unit:'ซอง',wh:'202'},
];
const slots = {A:{'A-01':[{code:'314-4-2000-55',name:'ฝาปั๊มเดิม',unit:'ฝา'},
  {code:'ONLY-PALLET',name:'กล่องพิเศษ',unit:'ใบ',remainingQty:0},
  {code:'11-PALLET',name:'ฉลากเดิมที่ตัด',unit:'ใบ',remainingQty:1},
  {code:'21-PALLET',name:'สินค้าเดิมที่ตัด',unit:'ใบ',remainingQty:1}]}};
const before = JSON.stringify({stock,slots});
const ctx = vm.createContext({STOCK:{items:stock},SLOT_ITEMS:slots});
vm.runInContext(['normalizeSearchText','isExcludedAddProductCode','getAddProductSuggestions'].map(extract).join('\n'),ctx);
assert.equal(ctx.getAddProductSuggestions('314-4')[0].code,'314-4-2000-55');
assert.equal(ctx.getAddProductSuggestions('314-4').length,1,'Multiple warehouses and pallet copies share one suggestion');
assert.equal(ctx.getAddProductSuggestions('ฝาปั๊ม')[0].unit,'ฝา');
assert.equal(ctx.getAddProductSuggestions('ขวดพิเศษ')[0].code,'PK-NEW','Suggest stock catalog items absent from pallets');
assert.equal(ctx.getAddProductSuggestions('กล่องพิเศษ')[0].code,'ONLY-PALLET','Suggest pallet items with no active balance');
assert.equal(ctx.getAddProductSuggestions('ขวดพิเศษ')[0].source,'สต็อก');
assert.equal(ctx.getAddProductSuggestions('ไม่พบ').length,0);
assert.equal(ctx.getAddProductSuggestions('11').length,0);
assert.equal(ctx.getAddProductSuggestions('21').length,0);
assert.equal(ctx.getAddProductSuggestions('51').length,0);
assert.equal(ctx.getAddProductSuggestions('ฉลากต้องตัดออก').length,0,'Name searches also omit code 1');
assert.equal(ctx.getAddProductSuggestions('ขวดต้องตัดออก').length,0,'Name searches also omit excluded codes');
assert.equal(ctx.getAddProductSuggestions('ฉลากเดิมที่ตัด').length,0,'Pallet catalog also excludes code 1');
assert.equal(ctx.getAddProductSuggestions('สินค้าเดิมที่ตัด').length,0,'Pallet catalog also excludes code 2');
assert.equal(ctx.isExcludedAddProductCode(' 51-0001-25'),true);
assert.equal(ctx.isExcludedAddProductCode('314-4-2000-55'),false);
Object.assign(ctx,{fseAddCode:{value:'314-4-2000-55'},fseAddName:{value:'ฝาปั๊ม'},fseAddReceiveDate:{value:'2026-09-15'},fseAddQty:{value:'10'},fseAddUnit:{value:'ชิ้น'}});
vm.runInContext(extract('isAddFormValid'),ctx);
assert.equal(ctx.isAddFormValid(),true);
for (const code of ['11-0001-10','21-0001-10','51-0001-25']) { ctx.fseAddCode.value=code; assert.equal(ctx.isAddFormValid(),false,'Manual entry cannot bypass exclusion'); }
assert.equal(JSON.stringify({stock,slots}),before,'Suggestions never alter source records');
assert.match(html,/id="fseAddCode"[^>]*role="combobox"[^>]*aria-controls="fseAddSuggestions"/);
assert.match(html,/fseAddCode\.addEventListener\('keydown'/);
assert.match(html,/selectAddProductSuggestion\(addSuggestionItems\[Number\(option\.dataset\.index\)\]\)/);
assert.doesNotMatch(html,/id="fseAddCodeHelp"/,'Excluded-code note stays hidden from the form');
console.log('PASS: add-product suggestions omit 1/2/5 codes in stock and pallet catalogs; manual add blocks them');
