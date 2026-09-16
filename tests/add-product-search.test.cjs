const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const extract = name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const stock = [
  {code:'314-4-2000-55',name:'ฝาปั๊ม PP สีขาว',unit:'ฝา',wh:'202'},
  {code:'314-4-2000-55',name:'ฝาปั๊ม PP สีขาว',unit:'ฝา',wh:'800'},
  {code:'PK-NEW',name:'ขวดพิเศษ',search_name:'บรรจุภัณฑ์เฉพาะ',unit:'ขวด',wh:'201'},
  {code:'11-0001-10',name:'ฉลากใหม่',unit:'ใบ',wh:'202'},
  {code:'21-0001-10',name:'ขวดใหม่',unit:'ขวด',wh:'202'},
  {code:'51-0001-25',name:'ซองใหม่',unit:'ซอง',wh:'202'},
];
const slots = {A:{'A-01':[{code:'314-4-2000-55',name:'ฝาปั๊มเดิม',unit:'ฝา'},
  {code:'ONLY-PALLET',name:'กล่องพิเศษ',unit:'ใบ',remainingQty:0},
  {code:'11-PALLET',name:'ฉลากเดิมที่ตัด',unit:'ใบ',remainingQty:1},
  {code:'21-PALLET',name:'สินค้าเดิมที่ตัด',unit:'ใบ',remainingQty:1}]}};
const before = JSON.stringify({stock,slots});
const ctx = vm.createContext({STOCK:{items:stock},SLOT_ITEMS:slots});
vm.runInContext(['normalizeSearchText','getAddProductSuggestions'].map(extract).join('\n'),ctx);
assert.equal(ctx.getAddProductSuggestions('314-4')[0].code,'314-4-2000-55');
assert.equal(ctx.getAddProductSuggestions('314-4').length,1,'Multiple warehouses and pallet copies share one suggestion');
assert.equal(ctx.getAddProductSuggestions('ฝาปั๊ม')[0].unit,'ฝา');
assert.equal(ctx.getAddProductSuggestions('2000')[0].code,'314-4-2000-55','Match a code fragment beginning with 2');
assert.equal(ctx.getAddProductSuggestions('สีขาว')[0].code,'314-4-2000-55','Match any product-name fragment');
assert.equal(ctx.getAddProductSuggestions('ขวดพิเศษ')[0].code,'PK-NEW','Suggest updated stock catalog items absent from pallets');
assert.equal(ctx.getAddProductSuggestions('เฉพาะ')[0].code,'PK-NEW','Match an optional stock search name');
assert.equal(ctx.getAddProductSuggestions('กล่องพิเศษ').length,0,'Do not suggest old pallet-only codes');
assert.equal(ctx.getAddProductSuggestions('ขวดพิเศษ')[0].source,'สต็อก');
assert.equal(ctx.getAddProductSuggestions('ไม่พบ').length,0);
assert.equal(ctx.getAddProductSuggestions('11')[0].code,'11-0001-10');
assert.equal(ctx.getAddProductSuggestions('21')[0].code,'21-0001-10');
assert.equal(ctx.getAddProductSuggestions('51')[0].code,'51-0001-25');
assert.equal(ctx.getAddProductSuggestions('ฉลากใหม่')[0].code,'11-0001-10');
assert.equal(ctx.getAddProductSuggestions('ขวดใหม่')[0].code,'21-0001-10');
assert.equal(ctx.getAddProductSuggestions('ฉลากเดิมที่ตัด').length,0,'Pallet-only products are absent');
assert.equal(ctx.getAddProductSuggestions('สินค้าเดิมที่ตัด').length,0,'Pallet-only products are absent');
Object.assign(ctx,{fseAddCode:{value:'314-4-2000-55'},fseAddName:{value:'ฝาปั๊ม'},fseAddReceiveDate:{value:'2026-09-15'},fseAddQty:{value:'10'},fseAddUnit:{value:'ชิ้น'},
  document:{getElementById(){return {value:'REC-001'}}}});
vm.runInContext(extract('isAddFormValid'),ctx);
assert.equal(ctx.isAddFormValid(),true);
ctx.document.getElementById=()=>({value:''});
assert.equal(ctx.isAddFormValid(),false,'New receipts require a document reference');
ctx.document.getElementById=()=>({value:'REC-001'});
for (const code of ['11-0001-10','21-0001-10','51-0001-25']) { ctx.fseAddCode.value=code; assert.equal(ctx.isAddFormValid(),true,'All stock-code prefixes are accepted'); }
assert.equal(JSON.stringify({stock,slots}),before,'Suggestions never alter source records');
assert.match(html,/id="fseAddCode"[^>]*role="combobox"[^>]*aria-controls="fseAddSuggestions"/);
assert.match(html,/fseAddCode\.addEventListener\('keydown'/);
assert.match(html,/selectAddProductSuggestion\(addSuggestionItems\[Number\(option\.dataset\.index\)\]\)/);
assert.doesNotMatch(html,/isExcludedAddProductCode/,'The old prefix rule is fully removed');
assert.doesNotMatch(html,/id="fseAddCodeHelp"/,'The old prefix note stays removed');
assert.doesNotMatch(html,/id="fseAddNote"/,'Add-item note field is no longer displayed');
console.log('PASS: updated-stock suggestions match partial code, product name and search name; prefixes 1/2/5 are accepted');
