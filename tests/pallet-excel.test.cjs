const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ctx=vm.createContext({});
for(const n of ['formatMovementDate','movementDateKey','movementNumber','getRemainingQty','getStockMovement','buildPalletExcelTables'])
 vm.runInContext(html.match(new RegExp(`function ${n}\\([^]*?\\n\\}`))[0],ctx);
const rows=[{zone:'A',slot_code:'A-01',version:2,occupied:true,items:[{code:'001',name:'=literal',lotNo:'0002',qty:10,remainingQty:8,unit:'pcs',receiveDate:'2026-09-05',withdrawals:[{date:'2026-09-05',qty:2}]},{code:'002',name:'unknown',note:{f:'BAD'}}]}];
const tables=ctx.buildPalletExcelTables(rows,[],{A:[{code:'A-01'},{code:'A-02'}]},[{label:'อาคารใหม่',zones:['A']}],{startedAt:'start',finishedAt:'end'});
assert.equal(tables.length,4);assert.equal(tables[1].rows.length,3);assert.match(tables[1].rows[2][3],/ยังไม่มีข้อมูล/);
const item=tables[2].rows[1];assert.equal(item[4],'001');assert.equal(item[6],'0002');assert.equal(item[5],'=literal');assert.equal(item[10],8);assert.equal(item[7].t,'n');assert.equal(item[7].z,'dd/mm/yyyy');
assert.equal(tables[2].rows[2][10],null);assert.equal(typeof tables[2].rows[2][13],'string');
assert.equal(tables[3].rows[2][10],2);assert.equal(tables[3].rows[2][12],8);
assert.equal(rows[0].items[0].remainingQty,8);assert.equal(rows.length,1);
console.log('PASS: Excel positions, text codes/lots, numeric quantities/dates, unknowns and movement balances');
