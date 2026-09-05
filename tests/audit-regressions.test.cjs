const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=n=>html.match(new RegExp(`(?:async )?function ${n}\\([^]*?\\n\\}`))[0];
const ctx=vm.createContext({BOM_COMPONENT_TYPES:{P:'packaging'},BOM_UNIT_CONVERSIONS:[],
  BOMPK:{assumptions:{excluded_warehouses:[]},kpis:{},bom_detail:{FG:{lines:[
    {pk_code:'P',unit:'ใบ',qty_per_unit:2},{pk_code:'P',unit:'ใบ',qty_per_unit:3}]}}},
  STOCK:{items:[{code:'P',qty:10,value:20,unit:'ใบ',wh:'200'}]},
  fgBomSearch:{value:''},renderBomSummary(){},renderFgBom(){},renderBomPlan(){}});
['bomNumber','normalizeBomUnit','bomComponentType','bomConversion','groupBomLines','recalculateBomFromStock',
  'calculateBomPlan','formatBomQuantity','stockNumber','aggregate'].forEach(n=>vm.runInContext(source(n),ctx));
const before=JSON.stringify(ctx.BOMPK.bom_detail.FG.lines);
ctx.recalculateBomFromStock();
let detail=ctx.BOMPK.bom_detail.FG;
assert.equal(detail.producible,2,'Same-code use 2+3 with stock10 supports 2 FG, not 3');
assert.equal(detail.lines.length,1);assert.equal(detail.lines[0].stock_avail,10);
assert.equal(detail.lines[0].source_line_count,2);
assert.equal(JSON.stringify(detail.source_lines),before,'Source formula not destroyed');
assert.equal(ctx.calculateBomPlan([{fg:'FG',qty:2}],ctx.BOMPK.bom_detail,ctx.STOCK.items,[]).ready,true);
assert.equal(ctx.calculateBomPlan([{fg:'FG',qty:3}],ctx.BOMPK.bom_detail,ctx.STOCK.items,[]).rows[0].shortage,5);
ctx.recalculateBomFromStock();assert.equal(detail.lines[0].qty_per_unit,5,'Refresh does not sum twice');
detail.source_lines[1].unit='ม้วน';ctx.recalculateBomFromStock();assert.equal(detail.producible,null,'Incompatible duplicate units block readiness');
ctx.BOM_UNIT_CONVERSIONS.push({code:'P',from:'ม้วน',to:'ใบ',factor:100,source:'Synthetic approval'});
ctx.recalculateBomFromStock();assert.equal(detail.lines[0].qty_per_unit,302);
assert.equal(ctx.formatBomQuantity(.0004),'<0.001');assert.equal(ctx.formatBomQuantity(0),'0');
assert.equal(ctx.formatBomQuantity(null),'ยังประเมินไม่ได้');
assert.throws(()=>ctx.stockNumber('abc'),/ตัวเลขไม่ถูกต้อง/);
assert.throws(()=>ctx.stockNumber('Infinity'),/ตัวเลขไม่ถูกต้อง/);
assert.equal(ctx.stockNumber('1,200.5'),1200.5);assert.equal(ctx.stockNumber('(12.5)'),-12.5);
const aggregated=ctx.aggregate([{code:'P',name:'Test',unit:'ใบ',qty:10,value:100,wh:'200',cat:'__proto__'},
  {code:'P',name:'Test',unit:'ม้วน',qty:2,value:200,wh:'201',cat:'__proto__'}]);
assert.equal(aggregated.top_items.length,2,'Never add sheets and rolls into one quantity');
assert.equal(aggregated.kpis.total_value,300);assert.equal(aggregated.kpis.unique_skus,1);
const tbody={};const document={querySelector:()=>tbody,getElementById:()=>({}),querySelectorAll:()=>[]};
ctx.document=document;ctx.escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
ctx.fmt2=ctx.fmt0=String;
vm.runInContext(source('renderTopItems'),ctx);
ctx.renderTopItems({top_items:[{name:'<img src=x onerror=alert(1)>',code:'<svg>',unit:'<b>',qty:1,value:1,whs:['<iframe>']}]},'all');
assert.ok(!tbody.innerHTML.includes('<img'));assert.ok(tbody.innerHTML.includes('&lt;img'));
console.log('PASS: repeated BOM capacity/value, unknown units, small quantities, invalid imports, mixed-stock units and escaped names');

(async()=>{
  const note={textContent:'',classList:{toggle(){}}};
  const loading=vm.createContext({STOCK:{report_date:'Test date'},DATA:{},stockSnapshotState:'loading',
    document:{querySelectorAll:()=>[note]},stockSupabaseClient:null,stockUpdateStatus:{},console:{warn(){}},rebuildStockControls(){}});
  vm.runInContext(source('renderStockSnapshotNotice')+'\n'+source('loadLatestStockFromSupabase'),loading);
  await loading.loadLatestStockFromSupabase();assert.equal(loading.stockSnapshotState,'fallback');assert.match(note.textContent,/ยังยืนยัน/);
  loading.stockSupabaseClient={rpc:async()=>({data:null,error:null})};
  await loading.loadLatestStockFromSupabase();assert.equal(loading.stockSnapshotState,'fallback');
  loading.stockSupabaseClient={rpc:async()=>({data:{items:[{}],report_date:'Current date'},error:null})};
  await loading.loadLatestStockFromSupabase();assert.equal(loading.stockSnapshotState,'latest');assert.match(note.textContent,/Current date/);
  const imports=vm.createContext({window:{XLSX:{}},XLSX:{read:x=>({SheetNames:[x.date],Sheets:{[x.date]:{}}}),utils:{sheet_to_json:()=>[]}},
    rowsFromMatrix:(matrix,name,date)=>({rows:[{wh:'200'}],reportDate:date}),REQUIRED_STOCK_WAREHOUSES:['200']});
  vm.runInContext(source('parseStockFiles'),imports);
  const file=date=>({name:date,arrayBuffer:async()=>({date})});
  await assert.rejects(()=>imports.parseStockFiles([file('Day1'),file('Day2')]),/วันที่สต็อก/);
  console.log('PASS: disconnected/empty/latest snapshots and inconsistent import dates');
})().catch(error=>{console.error(error);process.exitCode=1;});
