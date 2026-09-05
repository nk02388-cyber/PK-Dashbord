const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const data=new Map(),status={};
const ctx=vm.createContext({bomPlan:new Map(),BOM_PLAN_DRAFT_KEY:'test',STOCK:{report_date:'Day1'},
document:{getElementById:()=>status},localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}});
for(const n of ['filterBomPlanRows','parseBomPlanDraft','saveBomPlanDraft','restoreBomPlanDraft','bomPlanExportTables'])
vm.runInContext(html.match(new RegExp(`function ${n}\\([^]*?\\n\\}`))[0],ctx);
ctx.bomPlan.set('FG',10);ctx.saveBomPlanDraft();ctx.bomPlan.clear();ctx.restoreBomPlanDraft();assert.equal(ctx.bomPlan.get('FG'),10);
ctx.bomPlan.set('FG','');ctx.saveBomPlanDraft();ctx.bomPlan.clear();ctx.restoreBomPlanDraft();assert.equal(ctx.bomPlan.get('FG'),'','Keep invalid draft quantity for correction, never silently drop it');
assert.throws(()=>ctx.parseBomPlanDraft('{bad'));assert.throws(()=>ctx.parseBomPlanDraft('{"version":9,"entries":[]}'));
ctx.bomPlan.clear();ctx.saveBomPlanDraft();assert.equal(data.size,0);
const rows=[{code:'A',shortage:2,issues:[],notes:[],fgs:['FG']},{code:'B',shortage:null,issues:['Unit'],notes:[],fgs:['FG']},{code:'C',shortage:0,issues:[],notes:[],fgs:['FG']}];
assert.equal(ctx.filterBomPlanRows(rows,'shortage').length,1);assert.equal(ctx.filterBomPlanRows(rows,'unknown').length,1);assert.equal(ctx.filterBomPlanRows(rows,'all').length,3);
const tables=ctx.bomPlanExportTables([{fg:'FG',qty:10}],{FG:{fg_name:'=literal name'}},{rows,ready:false,errors:['Missing formula']},{exportedAt:'Now',stockDate:'Day1',status:'Fallback'});
assert.equal(tables.length,3);assert.equal(tables[2].rows.length,4,'Export includes all rows');assert.equal(tables[1].rows[1][1],'=literal name');assert.ok(tables[0].rows.some(r=>r[1]==='Fallback'));
ctx.localStorage.setItem=()=>{throw Error('quota')};ctx.bomPlan.set('FG',1);ctx.saveBomPlanDraft();assert.match(status.textContent,/บันทึกแผนร่างไม่ได้/);
console.log('PASS: draft restore/clear/invalid data/storage failure, filters and complete export tables');
