(function () {
  'use strict';

  function dateKey(value) {
    const text = String(value || '').trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(text);
    if (!iso && !slash) return null;
    let year = Number(iso ? iso[1] : slash[3]);
    if (year < 100) year += 1957;
    else if (year >= 2400) year -= 543;
    const month = Number(iso ? iso[2] : slash[2]);
    const day = Number(iso ? iso[3] : slash[1]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
  }

  function summarizeTopWithdrawals(slotItems, {asOf, days = 30, unit = ''} = {}) {
    const end = dateKey(asOf);
    if (!end) return {units:[], unit:'', rows:[], transactions:0};
    const endTime = Date.parse(end + 'T00:00:00Z');
    const start = days === 'all' ? null : new Date(endTime - (Number(days) - 1) * 86400000).toISOString().slice(0, 10);
    const groups = new Map(), unitTotals = new Map();
    for (const slots of Object.values(slotItems || {})) {
      for (const items of Object.values(slots || {})) {
        for (const item of items || []) {
          const code = String(item.code || '').trim().toUpperCase();
          if (!code) continue;
          for (const movement of item.withdrawals || []) {
            const date = dateKey(movement.date);
            const qty = Number(movement.qty);
            if (!date || date > end || (start && date < start) || !Number.isFinite(qty) || qty <= 0) continue;
            const rowUnit = String(movement.unit || item.unit || '').trim() || 'ไม่ระบุหน่วย';
            const key = JSON.stringify([code, rowUnit]);
            if (!groups.has(key)) groups.set(key, {code, name:String(item.name || '').trim(), unit:rowUnit, qty:0, transactions:0});
            const group = groups.get(key);
            if (!group.name && item.name) group.name = String(item.name).trim();
            group.qty += qty;
            group.transactions++;
            unitTotals.set(rowUnit, (unitTotals.get(rowUnit) || 0) + 1);
          }
        }
      }
    }
    const units = [...unitTotals].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'th')).map(([name,transactions]) => ({name,transactions}));
    const selectedUnit = units.some(row => row.name === unit) ? unit : (units[0]?.name || '');
    const rows = [...groups.values()].filter(row => row.unit === selectedUnit)
      .map(row => ({...row, qty:Number(row.qty.toFixed(8))}))
      .sort((a,b) => b.qty-a.qty || b.transactions-a.transactions || a.code.localeCompare(b.code,'th',{numeric:true}));
    return {units, unit:selectedUnit, rows, transactions:unitTotals.get(selectedUnit) || 0};
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {dateKey, summarizeTopWithdrawals};
    return;
  }

  const periodSelect = document.getElementById('topWithdrawalsPeriod');
  const unitSelect = document.getElementById('topWithdrawalsUnit');
  const list = document.getElementById('topWithdrawalsList');
  const status = document.getElementById('topWithdrawalsStatus');
  if (!periodSelect || !unitSelect || !list || !status) return;
  const escape = value => escapeHtml(String(value ?? ''));
  const number = value => Number(value).toLocaleString('en-US', {maximumFractionDigits:3});
  const todayBangkok = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(new Date()).map(part => [part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  function render() {
    if (!palletDataReady) {
      status.textContent = document.getElementById('syncStatusBar')?.classList.contains('sync-error')
        ? 'โหลดข้อมูลพาเลตไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ' : 'กำลังโหลดข้อมูลการเบิกจากพาเลต…';
      list.innerHTML = '';
      return;
    }
    const summary = summarizeTopWithdrawals(SLOT_ITEMS, {asOf:todayBangkok(),days:periodSelect.value,unit:unitSelect.value});
    unitSelect.innerHTML = summary.units.map(row => `<option value="${escape(row.name)}">${escape(row.name)}</option>`).join('');
    unitSelect.value = summary.unit;
    unitSelect.disabled = !summary.units.length;
    const periodLabel = periodSelect.options[periodSelect.selectedIndex].textContent;
    status.textContent = `ข้อมูลเบิกจากพาเลตทุกโซน · ${periodLabel} · ${summary.unit ? `${number(summary.transactions)} รายการเบิก · หน่วย ${summary.unit}` : 'ไม่มีรายการเบิกในช่วงนี้'}`;
    const top = summary.rows.slice(0,10);
    const max = top[0]?.qty || 1;
    list.innerHTML = top.length ? top.map((row,index) => `<div class="top-withdrawals-row">
      <span class="top-withdrawals-rank">${String(index+1).padStart(2,'0')}</span>
      <div class="top-withdrawals-item"><strong>${escape(row.name || 'ไม่ระบุชื่อสินค้า')}</strong><button type="button" data-code="${escape(row.code)}" aria-label="ดูประวัติ ${escape(row.code)}">${escape(row.code)}</button><div class="top-withdrawals-track" aria-hidden="true"><span style="width:${Math.max(2,row.qty/max*100)}%"></span></div></div>
      <div class="top-withdrawals-amount"><strong>${number(row.qty)} ${escape(row.unit)}</strong><small>${number(row.transactions)} ครั้ง</small></div>
    </div>`).join('') : '<p class="top-withdrawals-empty">ไม่มีรายการเบิกที่มีวันที่และจำนวนในช่วงเวลานี้</p>';
  }

  periodSelect.addEventListener('change', render);
  unitSelect.addEventListener('change', render);
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-code]');
    if (!button) return;
    window.PKProductHistory?.open(button.dataset.code);
    document.getElementById('tab-product-history')?.click();
  });
  window.PKTopWithdrawals = {refresh:render};
  render();
})();
