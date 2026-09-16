import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-odoo-'));
try {
  const source = path.join(dir, 'pallet.json');
  const output = path.join(dir, 'output');
  fs.writeFileSync(source, JSON.stringify({slot_items:{F:{'F-01':[
    {code:'0031',name:'Bottle',unit:'pcs',lotNo:'PK-1',qty:10,remainingQty:8,withdrawals:[{qty:2,unit:'pcs'}]},
    {code:'0031',name:'Bottle',unit:'pcs',lotNo:'PK-1',qty:4,remainingQty:4},
    {code:'0042',name:'Cap',unit:'pcs',qty:5,remainingQty:3}
  ]}}}));
  const result = JSON.parse(execFileSync(process.execPath, [path.resolve('tools/odoo-pallet-export.mjs'), source, output], {encoding:'utf8'}));
  assert.equal(result.products, 2);
  assert.equal(result.counts, 1);
  assert.equal(result.review, 1);
  const counts = fs.readFileSync(path.join(output,'opening-counts.csv'),'utf8');
  assert.match(counts, /"0031","PK-1","pcs","12","2"/);
  assert.doesNotMatch(counts, /"0042"/);
  assert.match(fs.readFileSync(path.join(output,'review.csv'),'utf8'), /differs from movement history/);
} finally { fs.rmSync(dir, {recursive:true,force:true}); }
