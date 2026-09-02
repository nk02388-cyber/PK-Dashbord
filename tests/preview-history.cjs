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
for (const [zone, slot, receiveDate] of [
  ['D', 'D-16', '2026-09-01'], ['D', 'D-21', '2026-08-04'],
  ['C', 'C-05', '2026-08-01'], ['C', 'C-06', '2026-08-04'],
]) {
  fixture[zone] ||= {};
  fixture[zone][slot] = [{ code: 'FIFO-DEMO', name: 'สินค้าทดสอบ FIFO', receiveDate,
    lotNo: 'LOT-' + slot, qty: 10, unit: 'ขวด' }];
}
http.createServer((req, res) => {
  let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  html = html.replace(/const (SUPABASE_URL|STOCK_SUPABASE_URL) = '[^']*';/g, "const $1 = ''; ");
  html = html.replace('const SLOT_ITEMS = (STOCK && STOCK.slot_items) || {};',
    `const SLOT_ITEMS = ${JSON.stringify(fixture)};`);
  html = html.replace('function captureMovementDraft(e) {', `
    for (const conflict of [false, true]) {
      const button = document.createElement('button');
      button.id = conflict ? 'fixture-conflict' : 'fixture-refresh';
      button.textContent = conflict ? 'Test remote conflict' : 'Test remote refresh';
      button.style.cssText = 'position:fixed;z-index:999999;bottom:0;left:' + (conflict ? 180 : 0) + 'px';
      button.onclick = () => {
        if (conflict) SLOT_ITEMS.F['F-18'][0].qty = 25;
        refreshAfterRemoteChange('F', 'F-18');
      };
      document.body.appendChild(button);
    }
    const failureButton = document.createElement('button');
    failureButton.id = 'fixture-failure';
    failureButton.textContent = 'Test save failure';
    failureButton.style.cssText = 'position:fixed;z-index:999999;bottom:0;left:360px';
    failureButton.onclick = () => {
      supabaseClient = {from(){return {
        select(){return this},eq(){return this},
        async maybeSingle(){
          refreshAfterRemoteChange('F', 'F-18');
          return {error:new Error('Test network failure — retry allowed')};
        }
      }}};
    };
    document.body.appendChild(failureButton);
    function captureMovementDraft(e) {`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(8767, '127.0.0.1', () => console.log('Isolated history preview: http://localhost:8767/'));
