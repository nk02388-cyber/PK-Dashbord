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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {findLowStock, negativeStock};
    return;
  }

  const toggle = document.getElementById('notificationToggle');
  const panel = document.getElementById('notificationPanel');
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationItems');
  if (!toggle || !panel || !badge || !list) return;
  const escape = value => escapeHtml(String(value ?? ''));
  const fmt = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:3});
  let pending = {count:null,rows:[],error:''}, requestId = 0;

  function render() {
    const stockReady = stockSnapshotState === 'latest';
    const low = stockReady ? findLowStock(STOCK.items) : {configured:0,rows:[]};
    const negative = stockReady ? negativeStock(STOCK.items) : [];
    const bomCount = stockReady ? Number(/^\s*([\d,]+)/.exec(document.getElementById('tabBadgeBompk')?.textContent || '')?.[1].replace(/,/g,'')) || 0 : 0;
    const syncProblem = document.getElementById('syncStatusBar')?.classList.contains('sync-error') || document.getElementById('syncStatusBar')?.classList.contains('sync-unavailable');
    const actions = [];
    if (pending.count > 0) actions.push({kind:'pending',tone:'warning',title:`${fmt(pending.count)} พาเลตรอจัดเก็บ`,detail:[...new Set(pending.rows.map(row => row.product_code).filter(Boolean))].join(' · ') || 'เปิดรายการรับเข้าและจัดเก็บ'});
    if (low.rows.length) actions.push({kind:'low',tone:'warning',title:`สินค้าเหลือต่ำ ${fmt(low.rows.length)} รหัส`,detail:`${low.rows[0].code} · คงเหลือ ${fmt(low.rows[0].qty)} ${low.rows[0].unit} / ขั้นต่ำ ${fmt(low.rows[0].minimum)}`});
    if (negative.length) actions.push({kind:'negative',tone:'critical',title:`สต็อกติดลบ ${fmt(negative.length)} รายการ`,detail:`เริ่มตรวจที่รหัส ${negative[0].code}`});
    if (bomCount > 0) actions.push({kind:'bom',tone:'critical',title:`บรรจุภัณฑ์ไม่พร้อม ${fmt(bomCount)} FG`,detail:'เปิดหน้าความพร้อมบรรจุภัณฑ์เพื่อตรวจสอบ'});
    if (stockSnapshotState === 'fallback') actions.push({kind:'stock',tone:'warning',title:'โหลดสต็อกล่าสุดไม่ได้',detail:'กำลังแสดงข้อมูลสำรองในไฟล์'});
    if (syncProblem) actions.push({kind:'sync',tone:'critical',title:'การซิงค์ข้อมูลพาเลตมีปัญหา',detail:'รีเฟรชหน้าเว็บหรือตรวจการเชื่อมต่อ'});
    if (pending.error) actions.push({kind:'pending-error',tone:'warning',title:'ตรวจรายการรอจัดเก็บไม่ได้',detail:'กดรีเฟรชเพื่อลองอีกครั้ง'});
    badge.hidden = !actions.length;
    badge.textContent = actions.length > 9 ? '9+' : String(actions.length);
    toggle.setAttribute('aria-label',actions.length ? `เปิดการแจ้งเตือน ${actions.length} ประเภท` : 'เปิดการแจ้งเตือน');
    list.innerHTML = actions.length ? actions.map(action => `<button type="button" class="notification-item" data-action="${action.kind}" data-tone="${action.tone}"><strong>${escape(action.title)}</strong><small>${escape(action.detail)}</small></button>`).join('') : '<p class="notification-empty">ไม่มีรายการที่ต้องดำเนินการ</p>';
    if (pending.count == null && !pending.error) list.insertAdjacentHTML('beforeend','<p class="notification-empty">กำลังตรวจรายการรอจัดเก็บ…</p>');
    if (stockReady && !low.configured) list.insertAdjacentHTML('beforeend','<p class="notification-hint">ยังไม่มีเกณฑ์ขั้นต่ำรายสินค้า จึงยังไม่แจ้งเตือนสินค้าเหลือต่ำ</p>');
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
  document.addEventListener('click',event => { if (!panel.hidden && !event.target.closest('.notification-anchor')) close(); });
  document.addEventListener('keydown',event => { if (event.key === 'Escape' && !panel.hidden) { close(); toggle.focus(); } });
  document.addEventListener('visibilitychange',() => { if (!document.hidden) refreshPending(); });
  list.addEventListener('click',event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    close();
    if (action === 'pending') {
      document.getElementById('tab-incoming')?.click();
      document.querySelector('[data-incoming-view="history"]')?.click();
    } else if (action === 'bom') document.getElementById('tab-bompk')?.click();
    else if (action === 'low' || action === 'negative') {
      const item = action === 'low' ? findLowStock(STOCK.items).rows[0] : negativeStock(STOCK.items)[0];
      if (item) { document.getElementById('tab-product-history')?.click(); window.PKProductHistory?.open(item.code); }
    } else if (action === 'stock') document.getElementById('tab-stock')?.click();
    else if (action === 'sync') document.getElementById('tab-floorplan')?.click();
    else if (action === 'pending-error') { panel.hidden = false; toggle.setAttribute('aria-expanded','true'); refreshPending(); }
  });
  window.PKNotifications = {refresh:refreshPending,refreshStock:render};
  render();
  refreshPending();
})();
