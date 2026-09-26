(function () {
  'use strict';

  const SOURCE_ID = '1qoDuHL4kAT4SFKv2nmpy8CBRRSut_dXm';
  const REFRESH_MS = 5 * 60 * 1000;
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${SOURCE_ID}/export?format=xlsx`;

  const text = value => String(value == null ? '' : value).trim();
  const number = value => {
    const parsed = Number(text(value).replace(/,/g, ''));
    return Number.isFinite(parsed) && text(value) !== '' ? parsed : null;
  };
  const sheetNameForDate = date => {
    const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(date || '');
    return parts ? `${parts[2]}.${parts[1]}` : '';
  };
  const localToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  function parseReceiptPlanSheet(matrix) {
    const headerIndex = matrix.findIndex(row => row.some(cell => text(cell) === 'รหัสสินค้า') && row.some(cell => text(cell) === 'PO'));
    if (headerIndex < 0) throw new Error('ไม่พบหัวตาราง PO / รหัสสินค้าในชีตวันที่เลือก');
    const headers = matrix[headerIndex].map(text);
    const column = label => headers.indexOf(label);
    const columns = {
      rr: column('RR No.(WH)'), company: column('ชื่อบริษัท'), period: column('ช่วงเวลา'),
      po: column('PO'), code: column('รหัสสินค้า'), item: column('รายการ'),
      quantity: column('จำนวน'), unit: column('หน่วย')
    };
    if (columns.code < 0 || columns.item < 0 || columns.quantity < 0)
      throw new Error('คอลัมน์แผนรับเข้าไม่ครบ กรุณาตรวจไฟล์ต้นทาง');
    let previousCompany = '', previousPeriod = '';
    return matrix.slice(headerIndex + 1).flatMap(row => {
      const get = key => columns[key] < 0 ? '' : text(row[columns[key]]);
      const company = get('company'), period = get('period');
      if (company && company !== '"') previousCompany = company;
      if (period && period !== '"') previousPeriod = period;
      const code = get('code'), item = get('item');
      if (!code || !item || /ไม่มีรายการ/.test(item)) return [];
      return [{rr:get('rr'),company:company === '"' || !company ? previousCompany : company,
        period:period === '"' || !period ? previousPeriod : period,
        po:get('po'),code,item,quantity:number(get('quantity')),unit:get('unit')}];
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {parseReceiptPlanSheet, sheetNameForDate};
    return;
  }

  const panel = document.getElementById('pane-receipt-plan');
  if (!panel) return;
  const date = document.getElementById('receiptPlanDate');
  const query = document.getElementById('receiptPlanQuery');
  const status = document.getElementById('receiptPlanStatus');
  const summary = document.getElementById('receiptPlanSummary');
  const result = document.getElementById('receiptPlanResult');
  const badge = document.getElementById('tabBadgeReceiptPlan');
  const refreshButton = document.getElementById('receiptPlanRefresh');
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let workbook = null, loadedAt = null, pending = null, followToday = true;
  date.value = localToday();

  function keepCurrentDay() {
    if (followToday && date.value !== localToday()) date.value = localToday();
  }

  function render() {
    if (!workbook) return;
    const selected = date.value;
    const sheetName = sheetNameForDate(selected);
    const sheet = workbook.Sheets[sheetName];
    let rows = [];
    try {
      if (sheet) rows = parseReceiptPlanSheet(XLSX.utils.sheet_to_json(sheet, {header:1, raw:false, defval:''}));
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message;
      summary.replaceChildren(); result.replaceChildren(); badge.textContent = 'ตรวจสอบ';
      return;
    }
    status.classList.remove('error');
    const stamp = loadedAt ? loadedAt.toLocaleString('th-TH') : '—';
    status.textContent = `${sheet ? `ชีต ${sheetName} · ${rows.length} รายการ` : `ไม่มีชีต ${sheetName} ในไฟล์ต้นทาง`} · โหลดล่าสุด ${stamp}`;
    badge.textContent = selected === localToday() ? `${rows.length} วันนี้` : `${rows.length} รายการ`;
    const key = query.value.trim().toLocaleLowerCase('th');
    const visible = key ? rows.filter(row => [row.rr,row.company,row.period,row.po,row.code,row.item,row.unit]
      .some(value => text(value).toLocaleLowerCase('th').includes(key))) : rows;
    const distinctCodes = new Set(rows.map(row => row.code)).size;
    const distinctCompanies = new Set(rows.map(row => row.company).filter(Boolean)).size;
    const kpis = [['รายการในแผน',rows.length],['รหัสสินค้า',distinctCodes],['บริษัท',distinctCompanies],['ผลค้นหา',visible.length]];
    summary.innerHTML = kpis.map(([label,value]) => `<div class="daily-kpi"><span>${escape(label)}</span><strong>${value.toLocaleString('en-US')}</strong></div>`).join('');
    result.innerHTML = visible.length ? `<div class="daily-table-wrap"><table class="daily-table">
      <thead><tr><th>ช่วงเวลา</th><th>บริษัท</th><th>PO</th><th>รหัสสินค้า</th><th>รายการ</th><th class="num">จำนวนแผน</th><th>หน่วย</th><th>RR No.(WH)</th></tr></thead>
      <tbody>${visible.map(row => `<tr><td>${escape(row.period || '—')}</td><td>${escape(row.company || '—')}</td><td>${escape(row.po || '—')}</td><td>${escape(row.code)}</td><td>${escape(row.item)}</td><td class="num">${row.quantity == null ? '—' : row.quantity.toLocaleString('en-US',{maximumFractionDigits:3})}</td><td>${escape(row.unit || '—')}</td><td>${escape(row.rr || '—')}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="daily-empty">${key ? 'ไม่พบรายการที่ตรงกับคำค้น' : sheet ? 'ไม่มีรายการรับเข้าในวันที่เลือก' : 'ยังไม่มีแผนรับเข้าในวันที่เลือก'}</div>`;
  }

  async function refresh(force = false) {
    keepCurrentDay();
    if (pending) return pending;
    if (!force && loadedAt && Date.now() - loadedAt.getTime() < REFRESH_MS) {render(); return;}
    if (!window.XLSX) {
      status.classList.add('error'); status.textContent = 'โหลดตัวอ่าน Excel ไม่สำเร็จ กรุณารีโหลดหน้าเว็บ';
      return;
    }
    refreshButton.disabled = true;
    status.classList.remove('error');
    status.textContent = workbook ? 'กำลังตรวจข้อมูลใหม่จาก Google Drive…' : 'กำลังโหลดไฟล์แผนจาก Google Drive…';
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(`${sourceUrl}&_=${Date.now()}`, {cache:'no-store', signal:controller.signal});
        if (!response.ok) throw new Error(`Google Drive ตอบกลับ HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 100) throw new Error('ไฟล์ที่ได้รับว่างหรือไม่ใช่ Excel');
        const next = XLSX.read(buffer, {type:'array'});
        if (!next.SheetNames.length) throw new Error('ไม่พบชีตในไฟล์ Excel');
        workbook = next;
        loadedAt = new Date();
        render();
      } catch (error) {
        status.classList.add('error');
        status.textContent = `โหลดแผนรับเข้าไม่สำเร็จ: ${error.name === 'AbortError' ? 'หมดเวลารอ Google Drive' : error.message}${workbook ? ' · ข้อมูลเดิมยังแสดงอยู่' : ''}`;
        if (!workbook) badge.textContent = 'โหลดไม่ได้';
      } finally {
        clearTimeout(timeout);
        refreshButton.disabled = false;
        pending = null;
      }
    })();
    return pending;
  }

  date.addEventListener('change', () => {followToday = date.value === localToday(); render();});
  query.addEventListener('input', render);
  document.getElementById('receiptPlanPrev').addEventListener('click', () => {
    const day = new Date(`${date.value || localToday()}T12:00:00`);
    day.setDate(day.getDate() - 1);
    date.value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    followToday = false;
    render();
  });
  document.getElementById('receiptPlanToday').addEventListener('click', () => {followToday = true; date.value = localToday(); render();});
  refreshButton.addEventListener('click', () => refresh(true));
  document.getElementById('tab-receipt-plan').addEventListener('click', () => refresh());
  document.addEventListener('visibilitychange', () => {if (!document.hidden && !panel.hidden) refresh();});
  setInterval(() => {if (!document.hidden && !panel.hidden) refresh();}, REFRESH_MS);
  refresh();
})();
