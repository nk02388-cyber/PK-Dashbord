(function () {
  'use strict';

  function collectDailyMovements(source, selectedDate, kind, toDateKey, toNumber) {
    const rows = [];
    const selectedKey = String(selectedDate || '').replace(/-/g,'');
    const add = (item, zone, slot, type, movement, fallbackDate, fallbackLot, fallbackUnit, fallbackBy, fallbackReference, fallbackRecordedAt) => {
      const date = movement?.date || fallbackDate || '';
      if (toDateKey(date) !== selectedKey) return;
      const qty = toNumber(movement?.qty ?? item.qty);
      if (qty == null || qty <= 0) return;
      rows.push({date:selectedDate, zone, slot, code:String(item.code || ''), name:String(item.name || ''),
        lotNo:String(movement?.lotNo ?? fallbackLot ?? ''), type, qty,
        unit:String(movement?.unit || fallbackUnit || ''), by:String(movement?.by || fallbackBy || ''),
        reference:String(movement?.reference || fallbackReference || ''), recordedAt:String(movement?.recordedAt || fallbackRecordedAt || '')});
    };
    for (const [zone, slots] of Object.entries(source || {})) {
      for (const [slot, items] of Object.entries(slots || {})) {
        for (const item of items || []) {
          if (kind === 'receive') {
            // A stock-card receipt follows an item after a whole-pallet move. Transfer rows
            // are internal movements and must not create a second daily receipt.
            add(item, zone, slot, 'รับเข้า', null, item.receiveDate, item.lotNo, item.unit, item.receivedBy, item.receiveReference, item.receivedAt);
            for (const movement of item.returns || [])
              add(item, zone, slot, 'รับคืน', movement, '', item.lotNo, item.unit, '');
          } else if (kind === 'issue') {
            for (const movement of item.withdrawals || [])
              add(item, zone, slot, 'เบิก', movement, '', item.lotNo, item.unit, '');
          }
        }
      }
    }
    return rows.sort((a,b) => a.zone.localeCompare(b.zone,'th',{numeric:true}) ||
      a.slot.localeCompare(b.slot,'th',{numeric:true}) || a.code.localeCompare(b.code,'th',{numeric:true}));
  }

  function summarizeDailyMovements(rows) {
    const units = new Map(), zones = new Map();
    for (const row of rows) {
      const unit = row.unit.trim() || 'ไม่ระบุหน่วย';
      units.set(unit, Number(((units.get(unit) || 0) + row.qty).toFixed(8)));
      zones.set(row.zone, (zones.get(row.zone) || 0) + 1);
    }
    return {transactions:rows.length, codes:new Set(rows.map(row => row.code).filter(Boolean)).size,
      slots:new Set(rows.map(row => `${row.zone}/${row.slot}`)).size,
      zones:zones.size, units:[...units].sort((a,b) => b[1]-a[1]),
      zoneCounts:[...zones].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'th',{numeric:true}))};
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {collectDailyMovements, summarizeDailyMovements};
    return;
  }

  const panels = [...document.querySelectorAll('.daily-panel')];
  const localToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  };
  const escape = value => escapeHtml(String(value == null ? '' : value));
  const number = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:3});

  function renderPanel(panel) {
    const kind = panel.dataset.kind;
    const selectedDate = panel.querySelector('.daily-date').value;
    const allRows = collectDailyMovements(SLOT_ITEMS, selectedDate, kind, movementDateKey, movementNumber);
    const summary = summarizeDailyMovements(allRows);
    const query = normalizeSearchText(panel.querySelector('.daily-query').value);
    const visible = query ? allRows.filter(row =>
      [row.code,row.name,row.lotNo,row.zone,row.slot,row.by,row.reference].some(value => normalizeSearchText(value).includes(query))) : allRows;
    panel.querySelector('.daily-status').textContent = `${palletDataReady ? 'ข้อมูลพาเลตล่าสุดจากระบบ' : 'กำลังโหลดข้อมูลพาเลต · ผลชั่วคราว'} · ${formatMovementDate(selectedDate)} · ${allRows.length} รายการ${query ? ` · แสดง ${visible.length} รายการ` : ''}`;
    panel.querySelector('.daily-kpis').innerHTML = [
      ['รายการ',summary.transactions],['รหัสสินค้า',summary.codes],['ตำแหน่งพาเลต',summary.slots],['โซน',summary.zones]
    ].map(([label,value]) => `<div class="daily-kpi"><span>${label}</span><strong>${number(value)}</strong></div>`).join('');
    const max = summary.zoneCounts[0]?.[1] || 1;
    panel.querySelector('.daily-chart').innerHTML = summary.zoneCounts.length
      ? summary.zoneCounts.slice(0,10).map(([zone,count]) => `<div class="daily-bar"><span>โซน ${escape(zone)}</span><div class="daily-bar-track"><div class="daily-bar-fill" style="width:${count/max*100}%"></div></div><strong>${number(count)}</strong></div>`).join('')
        + (summary.zoneCounts.length > 10 ? `<small>อีก ${summary.zoneCounts.length-10} โซนในตารางด้านล่าง</small>` : '')
      : '<div class="daily-empty">ไม่มีรายการในวันที่เลือก</div>';
    panel.querySelector('.daily-unit-list').innerHTML = summary.units.length
      ? summary.units.map(([unit,qty]) => `<span>${number(qty)} ${escape(unit)}</span>`).join('')
      : '<span>ไม่มียอดในวันที่เลือก</span>';
    panel.querySelector('.daily-result').innerHTML = visible.length ? `<div class="daily-table-wrap"><table class="daily-table">
      <thead><tr><th>ประเภท</th><th>โซน / พาเลต</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>Lot / PK No.</th><th class="num">จำนวน</th><th>หน่วย</th><th>ผู้ทำรายการ</th><th>เลขเอกสาร</th><th>บันทึกเมื่อ</th></tr></thead>
      <tbody>${visible.map(row => `<tr><td>${escape(row.type)}</td><td>${escape(row.zone)} / ${escape(row.slot)}</td><td>${escape(row.code)}</td><td>${escape(row.name)}</td><td>${escape(row.lotNo || '—')}</td><td class="num">${number(row.qty)}</td><td>${escape(row.unit || '—')}</td><td>${escape(row.by || '—')}</td><td>${escape(row.reference || '—')}</td><td>${row.recordedAt ? escape(new Date(row.recordedAt).toLocaleString('th-TH')) : '—'}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="daily-empty">${query ? 'ไม่พบรายการที่ตรงกับคำค้นในวันที่เลือก' : 'ไม่มีรายการในวันที่เลือก'}</div>`;
    const badge = document.getElementById(kind === 'receive' ? 'tabBadgeDailyReceive' : 'tabBadgeDailyIssue');
    badge.textContent = selectedDate === localToday() ? `${summary.transactions} วันนี้` : `${summary.transactions} รายการ`;
  }

  for (const panel of panels) {
    const date = panel.querySelector('.daily-date');
    date.value = localToday();
    date.addEventListener('change', () => renderPanel(panel));
    panel.querySelector('.daily-query').addEventListener('input', () => renderPanel(panel));
    panel.querySelector('.daily-today').addEventListener('click', () => { date.value = localToday(); renderPanel(panel); });
    panel.querySelector('.daily-prev').addEventListener('click', () => {
      const day = new Date(`${date.value || localToday()}T12:00:00`);
      day.setDate(day.getDate()-1);
      date.value = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      renderPanel(panel);
    });
  }
  window.PKDaily = {refresh() { panels.forEach(renderPanel); }};
  window.PKDaily.refresh();
})();
