(function (root) {
  'use strict';

  const excludedWarehouses = new Set(['800','900','401']);
  const codeKey = value => String(value ?? '').trim().toUpperCase();
  const unitKey = value => String(value ?? '').trim();
  const finiteQuantity = value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value));

  function evaluate(points, stockItems) {
    const stock = new Map();
    for (const item of stockItems || []) {
      if (excludedWarehouses.has(String(item.wh ?? '').trim())) continue;
      const code = codeKey(item.code), unit = unitKey(item.unit);
      if (!code || !unit) continue;
      const key = JSON.stringify([code,unit]);
      if (!stock.has(key)) stock.set(key,{qty:0,known:true});
      const group = stock.get(key);
      if (!finiteQuantity(item.qty)) group.known = false;
      else group.qty += Number(item.qty);
    }
    return (points || []).map(point => {
      const code = codeKey(point.code), unit = unitKey(point.unit);
      const group = stock.get(JSON.stringify([code,unit]));
      const rop = Number(point.rop);
      const eligible = (point.pattern === 'สม่ำเสมอ' || point.pattern === 'เป็นช่วง') && Number(point.historyWeeks) >= 8;
      const known = !!group?.known;
      const available = known ? group.qty : null;
      const gap = known && Number.isFinite(rop) ? Math.max(0,rop - available) : null;
      const status = !known ? 'unmatched' : !(Number.isFinite(rop) && rop > 0) ? 'unmatched'
        : available <= rop ? eligible ? 'alert' : 'review' : 'normal';
      return {...point,code,unit,available,gap,eligible,status};
    });
  }

  const counts = rows => rows.reduce((result,row) => (result[row.status]++,result),{alert:0,review:0,normal:0,unmatched:0});
  const searchRows = (rows, query, status) => {
    const terms = String(query ?? '').trim().toLocaleLowerCase('th-TH').split(/\s+/).filter(Boolean);
    return (rows || []).filter(row => (!status || status === 'all' || row.status === status)
      && terms.every(term => `${row.code} ${row.name} ${row.supplier}`.toLocaleLowerCase('th-TH').includes(term)));
  };

  const api = {evaluate,counts,searchRows};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.PKReorder = api;

  const panel = document.getElementById('pane-reorder');
  if (!panel) return;
  const query = document.getElementById('reorderSearch');
  const filter = document.getElementById('reorderFilter');
  const summary = document.getElementById('reorderSummary');
  const body = document.getElementById('reorderRows');
  const countLabel = document.getElementById('reorderCount');
  const notice = document.getElementById('reorderNotice');
  const badge = document.getElementById('tabBadgeReorder');
  const escape = value => escapeHtml(String(value ?? ''));
  const fmt = value => Number(value).toLocaleString('th-TH',{maximumFractionDigits:2});
  let rows = [];

  function render() {
    const trusted = stockSnapshotState === 'latest';
    rows = evaluate(PK_ROP_DATA,trusted ? STOCK.items : []);
    const totals = counts(rows);
    badge.textContent = trusted ? `${fmt(totals.alert)} ถึงจุด` : 'รอสต็อก';
    notice.textContent = trusted
      ? `เทียบสต็อกล่าสุด ${String(STOCK.report_date || '').replace(/^ณ วันที่:\s*/,'')} · จุดสั่งซื้อจากไฟล์วิเคราะห์ถึง 24 ก.ย. 69 · ยังไม่รวมใบสั่งซื้อค้างรับ`
      : 'กำลังรอสต็อกล่าสุดจากระบบ จะแสดงผลเปรียบเทียบเมื่อโหลดสำเร็จ';
    summary.innerHTML = `<div><strong>${trusted ? fmt(totals.alert) : '—'}</strong><span>ถึงจุดสั่งซื้อ</span></div><div><strong>${trusted ? fmt(totals.review) : '—'}</strong><span>ควรทบทวนเกณฑ์</span></div><div><strong>${trusted ? fmt(totals.unmatched) : '—'}</strong><span>จับคู่สต็อกไม่ได้</span></div><div><strong>${fmt(rows.length)}</strong><span>รหัสในไฟล์</span></div>`;
    const matching = searchRows(rows,query.value,filter.value);
    countLabel.textContent = `แสดง ${fmt(matching.length)} จาก ${fmt(rows.length)} รหัส`;
    body.innerHTML = matching.length ? matching.slice(0,200).map(row => {
      const label = trusted ? {alert:'ถึงจุดสั่งซื้อ',review:'ทบทวนเกณฑ์',normal:'ปกติ',unmatched:'จับคู่ไม่ได้'}[row.status] : 'รอสต็อกล่าสุด';
      return `<tr><td><button type="button" class="reorder-code" data-code="${escape(row.code)}">${escape(row.code)}</button><small>${escape(row.name)}</small></td><td>${escape(row.supplier || '—')}</td><td class="num">${row.available == null ? '—' : fmt(row.available)}</td><td class="num">${fmt(row.rop)}</td><td class="num">${row.gap == null ? '—' : fmt(row.gap)}</td><td>${escape(row.unit)}</td><td><span class="reorder-status" data-status="${row.status}">${label}</span><small>${escape(row.pattern)}${row.historyWeeks != null ? ` · ${fmt(row.historyWeeks)} สัปดาห์` : ''}</small></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="reorder-empty">ไม่พบรายการตามเงื่อนไข</td></tr>';
    if (matching.length > 200) countLabel.textContent += ' · ตารางแสดง 200 รายการแรก โปรดค้นหาเพื่อเจาะจง';
    root.PKNotifications?.refreshStock();
  }

  query.addEventListener('input',render);
  filter.addEventListener('change',render);
  body.addEventListener('click',event => {
    const code = event.target.closest('[data-code]')?.dataset.code;
    if (!code) return;
    document.getElementById('tab-product-history')?.click();
    root.PKProductHistory?.open(code);
  });
  api.refresh = render;
  api.open = code => { document.getElementById('tab-reorder')?.click(); query.value=code || ''; filter.value='all'; render(); };
  render();
})(typeof window !== 'undefined' ? window : globalThis);
