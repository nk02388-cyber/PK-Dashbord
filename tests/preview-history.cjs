// Isolated visual fixture: Supabase clients disabled; never writes production data.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const fixture = { F: { 'F-18': [{ code: 'DEMO-001', name: 'รายการทดสอบประวัติ',
  unit: 'ม้วน', qty: 21, remainingQty: 14, receiveDate: '2026-08-04', lotNo: 'DEMO',
  withdrawals: [{ qty: 9, unit: 'ม้วน', date: '2026-08-26', by: 'ทดสอบ' },
    { qty: 1, unit: 'ม้วน', date: '2026-09-01', by: 'ทดสอบ' }],
  returns: [{ qty: 3, unit: 'ม้วน', date: '2026-09-02', by: 'ทดสอบ' }],
  note: 'ข้อมูลจำลอง ไม่เชื่อมต่อ Supabase' },
  { code: 'DEMO-002', name: 'ทดสอบแยกหน่วย', qty: 5, unit: 'ขวด' },
  { code: 'DEMO-003', name: 'ทดสอบไม่ทราบยอด', unit: 'ม้วน' }] } };
http.createServer((req, res) => {
  let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  html = html.replace(/const (SUPABASE_URL|STOCK_SUPABASE_URL) = '[^']*';/g, "const $1 = ''; ");
  html = html.replace('const SLOT_ITEMS = (STOCK && STOCK.slot_items) || {};',
    `const SLOT_ITEMS = ${JSON.stringify(fixture)};`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(8767, '127.0.0.1', () => console.log('Isolated history preview: http://localhost:8767/'));
