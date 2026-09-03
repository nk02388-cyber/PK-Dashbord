const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Snapshot of embedded inventory/BOM data, product catalogs and floor-plan assets
// before this copy-only release. Deliberate data/asset updates must refresh this hash.
const protectedContent = html.split(/\r?\n/).filter(line => line.length > 10000).join('\n');
assert.equal(crypto.createHash('sha256').update(protectedContent).digest('hex'),
  '118e5f725d18c332f7323cece13674e6167164062ef10e59782054dd89b6ea88');
for (const copy of ['Packaging Stock &amp; BOM Dashboard', '↥ อัปเดตสต็อก',
  'สต็อกพร้อมใช้ (หน่วยตามสูตร)', 'สต็อกหลังใช้บรรจุภัณฑ์', 'มูลค่าหลังใช้บรรจุภัณฑ์ (บาท)',
  'นำเข้าข้อมูลพาเลต', 'กรอก PIN เพื่อยืนยันการอัปเดตสต็อก']) {
  assert.ok(html.includes(copy), `Missing copy: ${copy}`);
}
assert.ok(!/text-transform:\s*uppercase/.test(html));
assert.equal((html.match(/id="saveIconsBtn"/g) || []).length, 1);
assert.match(html, /<footer>[\s\S]*?id="saveIconsBtn"[\s\S]*?<\/footer>/);
console.log('PASS: consistent UI terminology/casing; source data and floor-plan assets unchanged');
