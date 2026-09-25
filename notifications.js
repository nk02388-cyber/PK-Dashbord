(function () {
  'use strict';

  function findLowStock(items) {
    const groups = new Map();
    let configured = 0;
    for (const item of items || []) {
      const code = String(item.code || '').trim();
      const unit = String(item.unit || '').trim() || 'ไม่ระบุหน่วย';
      const threshold = Number(item.min_qty ?? item.minQty ?? item.reorder_point);
      if (!code || !Number.isFinite(threshold) || threshold <= 0) continue;
      configured++;
      const key = JSON.stringify([code.toUpperCase(),unit]);
      if (!groups.has(key)) groups.set(key,{code,unit,name:String(item.name || ''),qty:0,minimum:threshold,known:true});
      groups.get(key).minimum = Math.max(groups.get(key).minimum,threshold);
    }
    for (const item of items || []) {
      const key = JSON.stringify([String(item.code || '').trim().toUpperCase(),String(item.unit || '').trim() || 'ไม่ระบุหน่วย']);
      const group = groups.get(key);
      if (!group) continue;
      const qty = Number(item.qty);
      if (item.qty == null || String(item.qty).trim() === '' || !Number.isFinite(qty)) group.known = false;
      else group.qty += qty;
    }
    return {configured, rows:[...groups.values()].filter(row => row.known && row.qty >= 0 && row.qty < row.minimum)
      .sort((a,b) => a.qty/a.minimum - b.qty/b.minimum || a.code.localeCompare(b.code,'th',{numeric:true}))};
  }

  function negativeStock(items) {
    return (items || []).filter(item => item.qty != null && String(item.qty).trim() !== '' && Number(item.qty) < 0);
  }

  function stockPalletMismatch(rows, cutoffStatus) {
    const mismatches = (rows || []).filter(row => row.status === 'ยอดไม่ตรง');
    if (!mismatches.length) return null;
    return {count:mismatches.length, example:mismatches[0],
      differentTimes:/พาเลตแก้หลังบันทึกสต็อก/.test(String(cutoffStatus || ''))};
  }

  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const actionSignature = action => JSON.stringify([action.kind,action.title,action.detail]);
  function restoredDismissals(raw, day) {
    try {
      const saved = JSON.parse(raw);
      return new Set(saved?.day === day && Array.isArray(saved.signatures) ? saved.signatures.filter(value => typeof value === 'string') : []);
    } catch { return new Set(); }
  }
  const visibleActions = (actions, dismissed) => actions.filter(action => !dismissed.has(actionSignature(action)));

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {findLowStock, negativeStock, stockPalletMismatch, dayKey, actionSignature, restoredDismissals, visibleActions};
    return;
  }

  const toggle = document.getElementById('notificationToggle');
  const panel = document.getElementById('notificationPanel');
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationItems');
  const clearButton = document.getElementById('notificationClear');
  if (!toggle || !panel || !badge || !list || !clearButton) return;
  const escape = value => escapeHtml(String(value ?? ''));
  const fmt = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:3});
  let pending = {count:null,rows:[],error:''}, requestId = 0;
  const storageKey = 'pk-notifications-dismissed-v1';
  let activeDay = dayKey(new Date());
  let dismissed = (() => { try { return restoredDismissals(localStorage.getItem(storageKey),activeDay); } catch { return new Set(); } })();
  let currentActions = [];
  function saveDismissed() {
    try { localStorage.setItem(storageKey,JSON.stringify({day:activeDay,signatures:[...dismissed]})); } catch { /* storage may be unavailable */ }
  }
  function ensureCurrentDay() {
    const today = dayKey(new Date());
    if (today === activeDay) return false;
    activeDay = today;
    dismissed.clear();
    saveDismissed();
    return true;
  }

  function render() {
    ensureCurrentDay();
    const stockReady = stockSnapshotState === 'latest';
    const reorderRows = stockReady ? PKReorder.evaluate(PK_ROP_DATA,STOCK.items).filter(row => row.status === 'alert') : [];
    const negative = stockReady ? negativeStock(STOCK.items) : [];
    const bomCount = stockReady ? Number(/^\s*([\d,]+)/.exec(document.getElementById('tabBadgeBompk')?.textContent || '')?.[1].replace(/,/g,'')) || 0 : 0;
    const syncProblem = document.getElementById('syncStatusBar')?.classList.contains('sync-error') || document.getElementById('syncStatusBar')?.classList.contains('sync-unavailable');
    const cutoff = stockReady && palletDataReady && !syncProblem ? reconciliationCutoff() : null;
    const mismatch = cutoff ? stockPalletMismatch(buildStockReconciliation(STOCK.items,[...palletRemoteRows.values()]),cutoff.cutoffStatus) : null;
    const actions = [];
    if (pending.count > 0) actions.push({kind:'pending',tone:'warning',title:`${fmt(pending.count)} พาเลตรอจัดเก็บ`,detail:[...new Set(pending.rows.map(row => row.product_code).filter(Boolean))].join(' · ') || 'เปิดรายการรับเข้าและจัดเก็บ'});
    if (reorderRows.length) actions.push({kind:'reorder',tone:'warning',title:`ถึงจุดสั่งซื้อ ${fmt(reorderRows.length)} รหัส`,detail:`${reorderRows[0].code} · คงเหลือ ${fmt(reorderRows[0].available)} ${reorderRows[0].unit} / ROP ${fmt(reorderRows[0].rop)}`});
    for (const event of window.PKEvents?.getDue?.() || []) actions.push({kind:`event:${event.id}`,tone:'warning',title:`นัดหมาย: ${event.name}`,detail:`${event.date} เวลา ${event.time}${event.details ? ` · ${event.details}` : ''}`});
    if (negative.length) actions.push({kind:'negative',tone:'critical',title:`สต็อกติดลบ ${fmt(negative.length)} รายการ`,detail:`เริ่มตรวจที่รหัส ${negative[0].code}`});
    if (mismatch) actions.push({kind:'reconcile',tone:'warning',title:`ยอดสต็อกกับพาเลตไม่ตรง ${fmt(mismatch.count)} รหัส/หน่วย`,
      detail:`ตัวอย่าง ${mismatch.example.code} · ${mismatch.differentTimes ? 'พาเลตแก้หลังบันทึกสต็อก ยอดอาจมาจากคนละเวลา' : 'ตรวจวันเวลาอ้างอิงก่อนสรุปผลต่าง'}`});
    if (bomCount > 0) actions.push({kind:'bom',tone:'critical',title:`บรรจุภัณฑ์ไม่พร้อม ${fmt(bomCount)} FG`,detail:'เปิดหน้าความพร้อมบรรจุภัณฑ์เพื่อตรวจสอบ'});
    if (stockSnapshotState === 'fallback') actions.push({kind:'stock',tone:'warning',title:'โหลดสต็อกล่าสุดไม่ได้',detail:'กำลังแสดงข้อมูลสำรองในไฟล์'});
    if (syncProblem) actions.push({kind:'sync',tone:'critical',title:'การซิงค์ข้อมูลพาเลตมีปัญหา',detail:'รีเฟรชหน้าเว็บหรือตรวจการเชื่อมต่อ'});
    if (pending.error) actions.push({kind:'pending-error',tone:'warning',title:'ตรวจรายการรอจัดเก็บไม่ได้',detail:'กดรีเฟรชเพื่อลองอีกครั้ง'});
    currentActions = visibleActions(actions,dismissed);
    clearButton.disabled = !currentActions.length;
    badge.hidden = !currentActions.length;
    badge.textContent = currentActions.length > 9 ? '9+' : String(currentActions.length);
    toggle.setAttribute('aria-label',currentActions.length ? `เปิดการแจ้งเตือน ${currentActions.length} ประเภท` : 'เปิดการแจ้งเตือน');
    list.innerHTML = currentActions.length ? currentActions.map(action => `<button type="button" class="notification-item" data-action="${escape(action.kind)}" data-tone="${action.tone}"><strong>${escape(action.title)}</strong><small>${escape(action.detail)}</small></button>`).join('') : `<p class="notification-empty">${actions.length ? 'ล้างการแจ้งเตือนวันนี้แล้ว · รายการใหม่จะแสดงเมื่อข้อมูลเปลี่ยน' : 'ไม่มีรายการที่ต้องดำเนินการ'}</p>`;
    if (pending.count == null && !pending.error) list.insertAdjacentHTML('beforeend','<p class="notification-empty">กำลังตรวจรายการรอจัดเก็บ…</p>');
  }

  async function refreshPending() {
    const current = ++requestId;
    if (!supabaseClient) { pending = {count:null,rows:[],error:'ไม่มีการเชื่อมต่อฐานข้อมูล'}; render(); return; }
    try {
      const {data,count,error} = await supabaseClient.from('incoming_pallets')
        .select('id,product_code,product_name,quantity,unit,received_on',{count:'exact'})
        .eq('status','pending').order('received_at',{ascending:false}).limit(3);
      if (error) throw error;
      if (current !== requestId) return;
      pending = {count:count ?? (data || []).length,rows:data || [],error:''};
    } catch (error) {
      if (current !== requestId) return;
      pending = {count:null,rows:[],error:error.message || 'โหลดข้อมูลไม่ได้'};
    }
    render();
  }

  function close() { panel.hidden = true; toggle.setAttribute('aria-expanded','false'); }
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded',String(open));
    if (open) refreshPending();
  });
  document.getElementById('notificationRefresh').addEventListener('click',refreshPending);
  clearButton.addEventListener('click',() => {
    if (ensureCurrentDay()) render();
    for (const action of currentActions) dismissed.add(actionSignature(action));
    saveDismissed();
    render();
  });
  document.addEventListener('click',event => { if (!panel.hidden && !event.target.closest('.notification-anchor')) close(); });
  document.addEventListener('keydown',event => { if (event.key === 'Escape' && !panel.hidden) { close(); toggle.focus(); } });
  document.addEventListener('visibilitychange',() => { if (!document.hidden) refreshPending(); });
  window.addEventListener('storage',event => {
    if (event.key !== storageKey) return;
    ensureCurrentDay();
    dismissed = restoredDismissals(event.newValue,activeDay);
    render();
  });
  function scheduleNextDay() {
    const now = new Date(), next = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    setTimeout(() => { render(); refreshPending(); scheduleNextDay(); },Math.max(1000,next.getTime()-now.getTime()+100));
  }
  scheduleNextDay();
  list.addEventListener('click',event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    close();
    if (action === 'pending') {
      document.getElementById('tab-incoming')?.click();
      document.querySelector('[data-incoming-view="history"]')?.click();
    } else if (action === 'bom') document.getElementById('tab-bompk')?.click();
    else if (action === 'reorder') document.getElementById('tab-reorder')?.click();
    else if (action === 'reconcile') {
      document.getElementById('stockReconcileFilter').value = 'mismatch';
      document.getElementById('stockReconcileSearch').value = '';
      document.getElementById('tab-reconcile')?.click();
      renderStockReconciliation();
    }
    else if (action.startsWith('event:')) window.PKEvents?.open(action.slice(6));
    else if (action === 'negative') {
      const item = negativeStock(STOCK.items)[0];
      if (item) { document.getElementById('tab-product-history')?.click(); window.PKProductHistory?.open(item.code); }
    } else if (action === 'stock') document.getElementById('tab-stock')?.click();
    else if (action === 'sync') document.getElementById('tab-floorplan')?.click();
    else if (action === 'pending-error') { panel.hidden = false; toggle.setAttribute('aria-expanded','true'); refreshPending(); }
  });
  window.PKNotifications = {refresh:refreshPending,refreshStock:render};
  render();
  refreshPending();
})();
