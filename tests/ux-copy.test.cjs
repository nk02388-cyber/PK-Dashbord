const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Snapshot of embedded inventory/BOM data, product catalogs and floor-plan assets.
// Deliberate asset updates must refresh this hash.
const protectedContent = html.split(/\r?\n/).filter(line => line.length > 10000).join('\n');
assert.equal(crypto.createHash('sha256').update(protectedContent).digest('hex'),
  '36c451b806232bbb47b542f8341840b3ed118dd9ee5564d27e791c9758cb83c7');
for (const copy of ['<title>BCL WMS</title>', 'class="header-product-name">BCL WMS</strong>', '>DASHBORD</span>', '↥ อัปเดตสต็อก',
  'สต็อกพร้อมใช้ (หน่วยตามสูตร)', 'สต็อกหลังใช้บรรจุภัณฑ์', 'มูลค่าหลังใช้บรรจุภัณฑ์ (บาท)',
  '>Import</button>', '>Export</button>', 'กรอก PIN เพื่อยืนยันการอัปเดตสต็อก']) {
  assert.ok(html.includes(copy), `Missing copy: ${copy}`);
}
assert.ok(!/text-transform:\s*uppercase/.test(html));
assert.equal((html.match(/id="saveIconsBtn"/g) || []).length, 1);
assert.match(html, /<footer>[\s\S]*?id="saveIconsBtn"[\s\S]*?<\/footer>/);
console.log('PASS: consistent UI terminology/casing; source data and floor-plan assets unchanged');
