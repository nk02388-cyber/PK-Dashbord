const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const names=['bomNumber','normalizeBomUnit','bomComponentType','bomConversion','recalculateBomFromStock'];
const source=names.map(n=>html.match(new RegExp(`function ${n}\\([^]*?\\n\\}`))[0]).join('\n');
function scenario(lines,items,conversions=[]) {
  const ctx=vm.createContext({BOM_COMPONENT_TYPES:{},BOM_UNIT_CONVERSIONS:conversions,
    BOMPK:{assumptions:{excluded_warehouses:['800','900']},kpis:{},bom_detail:{FG:{lines}}},STOCK:{items},
    fgBomSearch:{value:''},renderBomSummary(){},renderFgBom(){}});
  vm.runInContext(source,ctx);ctx.recalculateBomFromStock();return ctx;
}
const line=(code,unit='ใบ',qty=2)=>({pk_code:code,unit,qty_per_unit:qty,component_type:'packaging'});
const item=(code,unit,qty,wh='200')=>({code,unit,qty,wh,value:100});
let c=scenario([line('500-PACK')],[item('500-PACK','ใบ',20)]);
assert.equal(c.BOMPK.bom_detail.FG.producible,10,'An explicitly classified packaging code beginning with 5 must remain');
c=scenario([{...line('300-WIP'),component_type:'non_packaging'}],[]);
assert.equal(c.BOMPK.bom_detail.FG.lines.length,0,'A non-packaging component is excluded regardless of prefix');
c=scenario([{pk_code:'NEW',unit:'ใบ',qty_per_unit:1}],[]);
assert.equal(c.BOMPK.kpis.fg_unknown,1,'Unclassified code cannot silently become ready');
c=scenario([line('ROLL','ใบ')],[item('ROLL','ม้วน',2)]);
assert.equal(c.BOMPK.bom_detail.FG.producible,null);
assert.equal(c.BOMPK.bom_detail.FG.lines[0].stock_avail,null);
assert.match(c.BOMPK.bom_detail.FG.lines[0].calculation_error,/อัตราแปลง/);
assert.match(c.BOMPK.bom_detail.FG.lines[0].stock_source_note,/2 ม้วน/,'Keep the native stock quantity visible when conversion is missing');
c=scenario([line('ROLL','ใบ')],[item('ROLL','ม้วน',2),item('ROLL','ใบ',10)],
  [{code:'ROLL',from:'ม้วน',to:'ใบ',factor:100,source:'Approved test master'}]);
assert.equal(c.BOMPK.bom_detail.FG.producible,105);
assert.equal(c.BOMPK.bom_detail.FG.lines[0].stock_avail,210);
assert.match(c.BOMPK.bom_detail.FG.lines[0].conversion_note,/Approved test master/);
for(const factor of [0,-1,null,'',Infinity]) {
  c=scenario([line('ROLL','ใบ')],[item('ROLL','ม้วน',2)],[{code:'ROLL',from:'ม้วน',to:'ใบ',factor,source:'Test'}]);
  assert.equal(c.BOMPK.bom_detail.FG.producible,null);
}
c=scenario([line('ROLL','ใบ')],[item('ROLL','ม้วน',2)],[{code:'ROLL',from:'ม้วน',to:'ใบ',factor:100}]);
assert.equal(c.BOMPK.bom_detail.FG.producible,null,'Conversions require an explicit source');
c=scenario([line('PC','ชิ้น')],[item('PC','pcs',20)]);
assert.equal(c.BOMPK.bom_detail.FG.producible,10,'Unit aliases normalize without inventing ratios');
c=scenario([line('A'),line('B')],[item('A','ใบ',20),item('B','ม้วน',10)]);
assert.equal(c.BOMPK.bom_detail.FG.producible,null,'One unknown component must block a ready status');
assert.equal(c.BOMPK.kpis.fg_unknown,1);
assert.equal(c.BOMPK.kpis.fg_available,0);
c=scenario([line('A')],[item('A','ใบ',20),item('A','ม้วน',10,'900')]);
assert.equal(c.BOMPK.bom_detail.FG.producible,10,'Excluded warehouse units do not enter production quantity');
assert.equal(c.BOMPK.bom_detail.FG.lines[0].stock_excluded_warehouses[0].unit,'ม้วน');
for(const qty of [null,'',true,NaN]) {
  c=scenario([line('A')],[item('A','ใบ',qty)]);assert.equal(c.BOMPK.bom_detail.FG.producible,null);
}
c=scenario([line('A','')],[item('A','ใบ',10)]);assert.equal(c.BOMPK.kpis.fg_unknown,1);
console.log('PASS: explicit component types, native units, mixed units, sourced conversions and conservative unknown readiness');
