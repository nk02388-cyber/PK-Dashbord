(function () {
  'use strict';

  const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH').replace(/[\u0e48-\u0e4b]/g, '');
  const codeKey = value => String(value ?? '').trim().toUpperCase();

  function formatRecordedTime(value) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return '—';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return '—';
    const dateText = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
    const timeText = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
    return `${dateText} ${timeText} น.`;
  }

  function movementDateNumber(value) {
    const text = String(value || '').trim().replace(/^ณ วันที่:\s*/, '');
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(text);
    const thai = /^(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(\d{2,4})/.exec(text);
    if (!iso && !slash && !thai) return null;
    const month = iso ? Number(iso[2]) : slash ? Number(slash[2]) : ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'].indexOf(thai[2]) + 1;
    const day = Number(iso ? iso[3] : slash ? slash[1] : thai[1]);
    let year = Number(iso ? iso[1] : slash ? slash[3] : thai[3]);
    if (year < 100) year += 1957;
    else if (year >= 2400) year -= 543;
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : null;
  }

  function buildCatalog(stockItems, slotItems, latestSuppliers = {}) {
    const catalog = new Map();
    const add = (item, source) => {
      const code = codeKey(item?.code);
      if (!code) return;
      if (!catalog.has(code)) catalog.set(code, {code, names:new Set(), keywords:new Set(), inStock:false, onPallet:false});
      const product = catalog.get(code);
      const name = String(item.name || '').trim();
      if (name) product.names.add(name);
      for (const field of ['search_name','searchName','name_search']) {
        if (item[field]) product.keywords.add(String(item[field]));
      }
      if (source === 'stock') product.inStock = true;
      if (source === 'pallet') product.onPallet = true;
    };
    for (const item of stockItems || []) add(item, 'stock');
    for (const slots of Object.values(slotItems || {})) {
      for (const items of Object.values(slots || {})) for (const item of items || []) add(item, 'pallet');
    }
    for (const [code, latest] of Object.entries(latestSuppliers || {})) {
      add({code, name:latest.name}, 'supplier');
      const product = catalog.get(codeKey(code));
      if (product) {
        product.fromSupplierFile = true;
        if (latest.supplier) product.keywords.add(String(latest.supplier));
      }
    }
    return [...catalog.values()].map(product => ({...product, name:[...product.names][0] || '', searchText:normalize([product.code,...product.names,...product.keywords].join(' '))}));
  }

  function searchCatalog(catalog, query) {
    const words = normalize(query).split(' ').filter(Boolean);
    if (!words.length) return [];
    return catalog.filter(product => words.every(word => product.searchText.includes(word))).map(product => {
      const q = normalize(query), code = normalize(product.code), name = normalize(product.name);
      const rank = code === q ? 0 : code.startsWith(q) ? 1 : name.startsWith(q) ? 2 : code.includes(q) ? 3 : name.includes(q) ? 4 : 5;
      return {...product, rank};
    }).sort((a,b) => a.rank-b.rank || a.code.localeCompare(b.code,'th',{numeric:true}));
  }

  function collectMovements(slotItems, productCode, getLedger, latestSuppliers = {}) {
    const code = codeKey(productCode), rows = [];
    const latestName = String(latestSuppliers[code]?.supplier || '').trim();
    for (const [zone, slots] of Object.entries(slotItems || {})) {
      for (const [slot, items] of Object.entries(slots || {})) {
        for (const item of items || []) {
          if (codeKey(item.code) !== code) continue;
          for (const movement of getLedger(item).rows) {
            const recordedName = String(movement.supplierName || movement.supplier_name || item.supplierName || item.supplier_name || '').trim();
            rows.push({...movement, zone, slot, code, name:item.name || '', lotNo:movement.lotNo || item.lotNo || '',
              supplierName:movement.type === 'receive' ? recordedName || latestName : '',
              supplierSource:movement.type === 'receive' ? recordedName ? 'recorded' : latestName ? 'latest' : '' : ''});
          }
        }
      }
    }
    const dateKey = value => {
      const date = String(value || '').trim();
      const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(date);
      const local = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(date);
      if (!iso && !local) return '';
      let year = Number(iso ? iso[1] : local[3]);
      if (year < 100) year += 1957;
      else if (year >= 2400) year -= 543;
      const month = Number(iso ? iso[2] : local[2]);
      const day = Number(iso ? iso[3] : local[1]);
      return `${year.toString().padStart(4,'0')}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`;
    };
    return rows.sort((a,b) => {
      const aDate = dateKey(a.date), bDate = dateKey(b.date);
      if (!aDate || !bDate) return aDate ? -1 : bDate ? 1 : 0;
      return aDate.localeCompare(bDate) || String(a.recordedAt || '').localeCompare(String(b.recordedAt || ''));
    });
  }

  function summarizeStock(stockItems, productCode) {
    const code = codeKey(productCode), groups = new Map();
    for (const item of stockItems || []) {
      if (codeKey(item.code) !== code) continue;
      const wh = String(item.wh || '').trim() || 'ไม่ระบุคลัง';
      const unit = String(item.unit || '').trim() || 'ไม่ระบุหน่วย';
      const key = JSON.stringify([wh,unit]);
      if (!groups.has(key)) groups.set(key,{wh,unit,qty:0,known:true});
      const group = groups.get(key), qty = Number(item.qty);
      if (item.qty == null || String(item.qty).trim() === '' || !Number.isFinite(qty)) group.known = false;
      else group.qty += qty;
    }
    return [...groups.values()].sort((a,b) => a.wh.localeCompare(b.wh,'th',{numeric:true}) || a.unit.localeCompare(b.unit,'th'));
  }

  function summarizeBalances(stock) {
    const units = new Map();
    for (const row of stock || []) {
      const unit = String(row.unit || '').trim() || 'ไม่ระบุหน่วย';
      if (!units.has(unit)) units.set(unit,{unit,qty:0,known:true});
      const group = units.get(unit);
      if (!row.known) group.known = false;
      else group.qty += row.qty;
    }
    return [...units.values()].sort((a,b) => a.unit.localeCompare(b.unit,'th'));
  }

  function stockCardRows(movements) {
    const running = new Map();
    return (movements || []).map(row => {
      const unit = String(row.unit || '').trim() || 'ไม่ระบุหน่วย';
      const qty = row.qty == null || String(row.qty).trim() === '' ? null : Number(row.qty);
      const validQty = Number.isFinite(qty) && qty >= 0 ? qty : null;
      const inbound = row.type === 'receive' || row.type === 'return' || row.type === 'transfer_in';
      const outbound = row.type === 'withdraw' || row.type === 'transfer_out';
      const dated = movementDateNumber(row.date) != null;
      const previous = running.get(unit) ?? 0;
      let calculatedBalance = null;
      if (!dated || validQty == null || (!inbound && !outbound && row.type !== 'move')) running.set(unit, null);
      else if (running.get(unit) !== null) {
        calculatedBalance = Number((previous + (inbound ? validQty : outbound ? -validQty : 0)).toFixed(8));
        running.set(unit, calculatedBalance < 0 ? null : calculatedBalance);
        if (calculatedBalance < 0) calculatedBalance = null;
      }
      return {...row, received:inbound ? validQty : null, issued:outbound ? validQty : null, calculatedBalance};
    });
  }

  function reconcileStockCard(movements, balances, reportDate) {
    const cutoff = movementDateNumber(reportDate);
    const units = new Map((balances || []).map(row => [String(row.unit || '').trim() || 'ไม่ระบุหน่วย', {
      unit:String(row.unit || '').trim() || 'ไม่ระบุหน่วย', stockQty:row.known && Number.isFinite(row.qty) ? row.qty : null,
      recordedNet:0, complete:cutoff != null,
    }]));
    for (const row of movements || []) {
      const unit = String(row.unit || '').trim() || 'ไม่ระบุหน่วย';
      if (!units.has(unit)) units.set(unit,{unit,stockQty:null,recordedNet:0,complete:cutoff != null});
      const summary = units.get(unit);
      const date = movementDateNumber(row.date);
      if (date == null) { summary.complete = false; continue; }
      if (cutoff == null || date > cutoff) continue;
      const qty = row.qty == null || String(row.qty).trim() === '' ? null : Number(row.qty);
      if (!Number.isFinite(qty) || qty < 0) { summary.complete = false; continue; }
      if (row.type === 'receive' || row.type === 'return' || row.type === 'transfer_in') summary.recordedNet += qty;
      else if (row.type === 'withdraw' || row.type === 'transfer_out') summary.recordedNet -= qty;
      else if (row.type !== 'move') summary.complete = false;
    }
    return [...units.values()].map(row => {
      const recordedNet = Number(row.recordedNet.toFixed(8));
      return {...row, recordedNet,
        difference:row.complete && row.stockQty != null ? Number((recordedNet - row.stockQty).toFixed(8)) : null};
    }).sort((a,b) => a.unit.localeCompare(b.unit,'th'));
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {buildCatalog, searchCatalog, collectMovements, summarizeStock, summarizeBalances, stockCardRows, reconcileStockCard, formatRecordedTime};
    return;
  }

  const queryInput = document.getElementById('productHistoryQuery');
  const matchesEl = document.getElementById('productHistoryMatches');
  const statusEl = document.getElementById('productHistorySearchStatus');
  const detailEl = document.getElementById('productHistoryDetail');
  if (!queryInput || !matchesEl || !statusEl || !detailEl) return;
  const escape = value => escapeHtml(String(value ?? ''));
  const fmt = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:3});
  let selectedCode = '', shown = 100;

  function renderDetail() {
    if (!selectedCode) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    const product = buildCatalog(STOCK.items, SLOT_ITEMS, PK_LATEST_SUPPLIERS).find(row => row.code === selectedCode);
    if (!product) { selectedCode = ''; renderDetail(); return; }
    const stock = summarizeStock(STOCK.items, selectedCode);
    const movements = collectMovements(SLOT_ITEMS, selectedCode, getStockMovement, PK_LATEST_SUPPLIERS);
    const balances = summarizeBalances(stock);
    const cardRows = stockCardRows(movements);
    const reconciliation = reconcileStockCard(movements, balances, STOCK.report_date);
    const loading = !palletDataReady;
    const syncFailed = document.getElementById('syncStatusBar')?.classList.contains('sync-error');
    const stockLabel = stockSnapshotState === 'latest' ? 'สต็อกล่าสุดจากระบบ' : 'สต็อกสำรองในไฟล์';
    const stockDate = String(STOCK.report_date || 'ไม่ระบุวันที่').replace(/^ณ วันที่:\s*/, '');
    detailEl.hidden = false;
    detailEl.innerHTML = `<div class="product-history-product"><div><strong>${escape(product.code)}</strong><h3>${escape(product.name || 'ไม่ระบุชื่อสินค้า')}</h3></div><span>${escape(stockLabel)}</span></div>
      <section class="product-history-section"><h3>ยอดคงเหลือตามคลัง</h3><p class="product-history-note">${escape(String(STOCK.report_date || 'ไม่ระบุวันที่สต็อก'))}</p>
        <div class="product-history-stock">${stock.length ? stock.map(row => `<div><span>คลัง ${escape(row.wh)} · ${escape(row.unit)}</span><strong>${row.known ? fmt(row.qty) : 'ไม่ทราบจำนวน'}</strong></div>`).join('') : '<p>ไม่มีรหัสนี้ในสต็อกที่อัปเดต</p>'}</div></section>
      <section class="product-history-section"><div class="product-history-section-head"><h3>ประวัติการเคลื่อนไหวบนพาเลต</h3><span>${loading ? (syncFailed ? 'โหลดข้อมูลไม่สำเร็จ' : 'กำลังโหลดข้อมูลพาเลต…') : `${fmt(movements.length)} รายการ`}</span></div>
        ${loading ? `<p class="product-history-empty">${syncFailed ? 'โหลดข้อมูลพาเลตไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ' : 'กำลังโหลดข้อมูลพาเลต กรุณารอสักครู่'}</p>` : movements.length ? `<div class="product-history-table-wrap"><table><thead><tr><th>วันที่</th><th>บันทึกเมื่อ</th><th>รายการ</th><th>โซน / ตำแหน่ง</th><th>Lot / PK No.</th><th class="num">รับเข้า</th><th class="num">จ่ายออก</th><th class="num">ยอดสะสมตามบันทึก</th><th>หน่วย</th><th>ผู้ส่งสินค้า</th><th>ผู้ทำรายการ</th><th>เลขเอกสาร</th></tr></thead><tbody>${cardRows.slice(0,shown).map(row => `<tr><td>${escape(formatMovementDate(row.date))}</td><td>${escape(formatRecordedTime(row.recordedAt))}</td><td><span class="product-history-type product-history-type-${escape(row.type)}">${escape(row.label)}</span></td><td>${escape(row.zone)} / ${escape(row.slot)}</td><td>${escape(row.lotNo || '—')}</td><td class="num">${row.received == null ? '—' : fmt(row.received)}</td><td class="num">${row.issued == null ? '—' : fmt(row.issued)}</td><td class="num product-history-running">${row.calculatedBalance == null ? '—' : fmt(row.calculatedBalance)}</td><td>${escape(row.unit || '—')}</td><td>${escape(row.supplierName || '—')}</td><td>${escape(row.by || '—')}</td><td>${escape(row.reference || '—')}</td></tr>`).join('')}</tbody></table></div>${movements.length > shown ? `<button class="product-history-more" type="button">แสดงเพิ่มเติม (${fmt(movements.length-shown)} รายการ)</button>` : ''}` : '<p class="product-history-empty">ยังไม่มีประวัติการเคลื่อนไหวบนพาเลตสำหรับรหัสนี้</p>'}
        ${!loading && movements.length ? `<div class="product-history-reconcile"><strong>เทียบกับสต็อก ณ ${escape(stockDate)}</strong>${reconciliation.map(row => `<p>หน่วย ${escape(row.unit)} · สุทธิตามบันทึก ${row.complete ? fmt(row.recordedNet) : 'คำนวณไม่ได้'} · สต็อก ${row.stockQty == null ? 'ไม่ทราบ' : fmt(row.stockQty)} · <span class="${row.difference == null ? '' : row.difference === 0 ? 'is-matched' : 'is-different'}">ผลต่าง (บันทึก − สต็อก) ${row.difference == null ? 'คำนวณไม่ได้' : `${row.difference > 0 ? '+' : ''}${fmt(row.difference)}`}</span></p>`).join('')}</div><p class="product-history-note">ยอดสะสมเริ่มจาก 0 ตามรายการพาเลตที่ยังมีบันทึกเท่านั้น; หากผลต่างไม่เป็น 0 แปลว่าบันทึกเหล่านี้อธิบายยอดสต็อก ณ วันอ้างอิงได้ไม่ครบ ไม่ควรใช้ยอดสะสมแทนยอดสต็อกจริง</p>` : ''}
        ${movements.some(row => row.supplierSource === 'latest') ? '<p class="product-history-note">ชื่อผู้ส่งสินค้าบางรายการอ้างอิงจากการรับเข้าล่าสุดของรหัสสินค้า ไม่ได้ยืนยันผู้ส่งสินค้าของรายการย้อนหลัง</p>' : ''}
        <p class="product-history-note">บันทึกเมื่อแสดงวันและเวลาไทยจากระบบ ซึ่งอาจต่างจากวันที่รายการ; — หมายถึงไม่มีเวลาบันทึกในข้อมูลย้อนหลัง</p>
        <p class="product-history-note">รายการรับเข้า เบิก รับคืน และย้าย อ้างอิงบันทึกพาเลตในระบบ; สต็อกที่อัปเดตเป็นยอดคงเหลือ ไม่ใช่ประวัติรายการ</p></section>`;
    detailEl.querySelector('.product-history-more')?.addEventListener('click', () => { shown += 100; renderDetail(); });
  }

  function renderMatches() {
    const query = queryInput.value.trim();
    if (!query) { matchesEl.innerHTML = ''; statusEl.textContent = 'พิมพ์เพื่อค้นหาสินค้า'; renderDetail(); return; }
    const results = searchCatalog(buildCatalog(STOCK.items, SLOT_ITEMS, PK_LATEST_SUPPLIERS), query);
    statusEl.textContent = results.length ? `พบ ${fmt(results.length)} รหัสสินค้า${results.length > 50 ? ' · แสดง 50 รายการแรก' : ''}` : 'ไม่พบชื่อหรือรหัสที่ตรงกับคำค้น';
    matchesEl.innerHTML = results.slice(0,50).map(product => `<button type="button" class="product-history-match${product.code === selectedCode ? ' is-selected' : ''}" data-code="${escape(product.code)}"><strong>${escape(product.code)}</strong><span>${escape(product.name || 'ไม่ระบุชื่อสินค้า')}</span><small>${product.inStock ? 'มีในสต็อก' : product.onPallet ? 'พบในพาเลต' : 'พบในไฟล์ผู้ส่งสินค้า'}${product.onPallet ? ' · มีบันทึกพาเลต' : ''}</small></button>`).join('');
    renderDetail();
  }

  queryInput.addEventListener('input', renderMatches);
  queryInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const first = matchesEl.querySelector('.product-history-match');
    if (first) { event.preventDefault(); first.click(); }
  });
  matchesEl.addEventListener('click', event => {
    const button = event.target.closest('.product-history-match');
    if (!button) return;
    selectedCode = codeKey(button.dataset.code); shown = 100;
    matchesEl.querySelectorAll('.product-history-match').forEach(el => el.classList.toggle('is-selected',el === button));
    renderDetail();
    detailEl.scrollIntoView({block:'nearest',behavior:'smooth'});
  });
  document.getElementById('productHistoryClear').addEventListener('click', () => {
    queryInput.value = ''; selectedCode = ''; shown = 100; renderMatches(); queryInput.focus();
  });
  window.PKProductHistory = {
    refresh() { if (queryInput.value.trim() || selectedCode) renderMatches(); },
    open(code) { queryInput.value = String(code || '').trim(); selectedCode = codeKey(code); shown = 100; renderMatches(); }
  };
})();
