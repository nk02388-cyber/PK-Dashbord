(function () {
  'use strict';

  const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH').replace(/[\u0e48-\u0e4b]/g, '');
  const codeKey = value => String(value ?? '').trim().toUpperCase();

  function buildCatalog(stockItems, slotItems) {
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
      else product.onPallet = true;
    };
    for (const item of stockItems || []) add(item, 'stock');
    for (const slots of Object.values(slotItems || {})) {
      for (const items of Object.values(slots || {})) for (const item of items || []) add(item, 'pallet');
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

  function collectMovements(slotItems, productCode, getLedger) {
    const code = codeKey(productCode), rows = [];
    for (const [zone, slots] of Object.entries(slotItems || {})) {
      for (const [slot, items] of Object.entries(slots || {})) {
        for (const item of items || []) {
          if (codeKey(item.code) !== code) continue;
          for (const movement of getLedger(item).rows) rows.push({...movement, zone, slot, code, name:item.name || '', lotNo:movement.lotNo || item.lotNo || '',
            supplierName:movement.type === 'receive' ? String(item.supplierName || item.supplier_name || '').trim() : ''});
        }
      }
    }
    const dateKey = value => {
      const date = String(value || '').trim();
      const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(date);
      const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(date);
      if (iso) return `${iso[1]}${iso[2].padStart(2,'0')}${iso[3].padStart(2,'0')}`;
      if (local) return `${local[3]}${local[2].padStart(2,'0')}${local[1].padStart(2,'0')}`;
      return '';
    };
    return rows.sort((a,b) => dateKey(b.date).localeCompare(dateKey(a.date)) || String(b.recordedAt || '').localeCompare(String(a.recordedAt || '')));
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {buildCatalog, searchCatalog, collectMovements, summarizeStock, summarizeBalances};
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
    const product = buildCatalog(STOCK.items, SLOT_ITEMS).find(row => row.code === selectedCode);
    if (!product) { selectedCode = ''; renderDetail(); return; }
    const stock = summarizeStock(STOCK.items, selectedCode);
    const movements = collectMovements(SLOT_ITEMS, selectedCode, getStockMovement);
    const balances = summarizeBalances(stock);
    const loading = !palletDataReady;
    const syncFailed = document.getElementById('syncStatusBar')?.classList.contains('sync-error');
    const stockLabel = stockSnapshotState === 'latest' ? 'สต็อกล่าสุดจากระบบ' : 'สต็อกสำรองในไฟล์';
    const stockDate = String(STOCK.report_date || 'ไม่ระบุวันที่').replace(/^ณ วันที่:\s*/, '');
    const balanceValues = balances.length ? balances.map(row => `<p><strong>${row.known ? fmt(row.qty) : '—'}</strong><small>${escape(row.unit)}</small></p>`).join('') : '<p><strong>—</strong></p>';
    detailEl.hidden = false;
    detailEl.innerHTML = `<div class="product-history-product"><div><strong>${escape(product.code)}</strong><h3>${escape(product.name || 'ไม่ระบุชื่อสินค้า')}</h3></div><span>${escape(stockLabel)}</span></div>
      <section class="product-history-balance" aria-label="ยอดคงเหลือในสต็อก"><span>คงเหลือในสต็อก · ${escape(stockDate)}</span><div>${balanceValues}</div></section>
      <section class="product-history-section"><h3>ยอดคงเหลือตามคลัง</h3><p class="product-history-note">${escape(String(STOCK.report_date || 'ไม่ระบุวันที่สต็อก'))}</p>
        <div class="product-history-stock">${stock.length ? stock.map(row => `<div><span>คลัง ${escape(row.wh)} · ${escape(row.unit)}</span><strong>${row.known ? fmt(row.qty) : 'ไม่ทราบจำนวน'}</strong></div>`).join('') : '<p>ไม่มีรหัสนี้ในสต็อกที่อัปเดต</p>'}</div></section>
      <section class="product-history-section"><div class="product-history-section-head"><h3>ประวัติการเคลื่อนไหวบนพาเลต</h3><span>${loading ? (syncFailed ? 'โหลดข้อมูลไม่สำเร็จ' : 'กำลังโหลดข้อมูลพาเลต…') : `${fmt(movements.length)} รายการ`}</span></div>
        ${loading ? `<p class="product-history-empty">${syncFailed ? 'โหลดข้อมูลพาเลตไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ' : 'กำลังโหลดข้อมูลพาเลต กรุณารอสักครู่'}</p>` : movements.length ? `<div class="product-history-table-wrap"><table><thead><tr><th>วันที่</th><th>รายการ</th><th>โซน / ตำแหน่ง</th><th>Lot / PK No.</th><th class="num">จำนวน</th><th>หน่วย</th><th>ผู้ส่งสินค้า</th><th>ผู้ทำรายการ</th><th>เลขเอกสาร</th></tr></thead><tbody>${movements.slice(0,shown).map(row => `<tr><td>${escape(formatMovementDate(row.date))}</td><td><span class="product-history-type product-history-type-${escape(row.type)}">${escape(row.label)}</span></td><td>${escape(row.zone)} / ${escape(row.slot)}</td><td>${escape(row.lotNo || '—')}</td><td class="num">${row.qty == null ? 'ไม่ระบุ' : fmt(row.qty)}</td><td>${escape(row.unit || '—')}</td><td>${escape(row.supplierName || '—')}</td><td>${escape(row.by || '—')}</td><td>${escape(row.reference || '—')}</td></tr>`).join('')}</tbody></table></div>${movements.length > shown ? `<button class="product-history-more" type="button">แสดงเพิ่มเติม (${fmt(movements.length-shown)} รายการ)</button>` : ''}` : '<p class="product-history-empty">ยังไม่มีประวัติการเคลื่อนไหวบนพาเลตสำหรับรหัสนี้</p>'}
        <p class="product-history-note">รายการรับเข้า เบิก รับคืน และย้าย อ้างอิงบันทึกพาเลตในระบบ; สต็อกที่อัปเดตเป็นยอดคงเหลือ ไม่ใช่ประวัติรายการ</p></section>`;
    detailEl.querySelector('.product-history-more')?.addEventListener('click', () => { shown += 100; renderDetail(); });
  }

  function renderMatches() {
    const query = queryInput.value.trim();
    if (!query) { matchesEl.innerHTML = ''; statusEl.textContent = 'พิมพ์เพื่อค้นหาสินค้า'; renderDetail(); return; }
    const results = searchCatalog(buildCatalog(STOCK.items, SLOT_ITEMS), query);
    statusEl.textContent = results.length ? `พบ ${fmt(results.length)} รหัสสินค้า${results.length > 50 ? ' · แสดง 50 รายการแรก' : ''}` : 'ไม่พบชื่อหรือรหัสที่ตรงกับคำค้น';
    matchesEl.innerHTML = results.slice(0,50).map(product => `<button type="button" class="product-history-match${product.code === selectedCode ? ' is-selected' : ''}" data-code="${escape(product.code)}"><strong>${escape(product.code)}</strong><span>${escape(product.name || 'ไม่ระบุชื่อสินค้า')}</span><small>${product.inStock ? 'มีในสต็อก' : 'พบในพาเลต'}${product.onPallet ? ' · มีบันทึกพาเลต' : ''}</small></button>`).join('');
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
  window.PKProductHistory = {refresh() { if (queryInput.value.trim() || selectedCode) renderMatches(); }};
})();
