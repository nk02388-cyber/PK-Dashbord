// History is read from the database, never reconstructed from this browser's cache.
(() => {
  const actor = document.getElementById('palletAuditActor');
  const search = document.getElementById('palletAuditSearch');
  const status = document.getElementById('palletAuditStatus');
  const result = document.getElementById('palletAuditResult');
  const more = document.getElementById('palletAuditMore');
  try { actor.value = localStorage.getItem('palletAuditActor') || ''; } catch (_) {}
  const labels = {receive:'รับเข้า',issue:'เบิก',return:'รับคืน',transfer:'ย้าย',adjust:'แก้ยอด / แก้รายการ',remove:'ลบ',import:'นำเข้าข้อมูล'};
  const pageSize = 100;
  let rows = [], cursor = null, loading = false;
  const safe = value => escapeHtml(String(value ?? ''));
  function quantities(items) {
    const groups = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const key = [item.code || '', item.lotNo || '', item.unit || ''].join('\u001f');
      const value = item.remainingQty ?? item.qty;
      const old = groups.get(key);
      groups.set(key, value == null || !Number.isFinite(Number(value)) || old === null ? null : (old || 0) + Number(value));
    }
    return groups;
  }
  function changes(row) {
    const before = quantities(row.before_items), after = quantities(row.after_items);
    return [...new Set([...before.keys(), ...after.keys()])].filter(key => before.get(key) !== after.get(key)).map(key => {
      const [code,lot,unit] = key.split('\u001f');
      const value = n => n === null ? 'ไม่ทราบ' : Number(n || 0).toLocaleString('th-TH');
      return `<div>${safe(code)}${lot ? ` · Lot ${safe(lot)}` : ''}: <b>${value(before.get(key))} → ${value(after.get(key))} ${safe(unit)}</b></div>`;
    }).join('') || '<span>เปลี่ยนข้อมูลรายการโดยยอดคงเหลือเท่าเดิม</span>';
  }
  function render() {
    const q = search.value.trim().toLocaleLowerCase();
    const shown = rows.filter(row => !q || [row.zone,row.slot_code,row.actor_name,row.document_no,row.action,JSON.stringify(row.after_items)].join(' ').toLocaleLowerCase().includes(q));
    status.textContent = `${shown.length} รายการ${q ? ' จากข้อมูลที่โหลดแล้ว' : ''}`;
    result.innerHTML = shown.length ? `<div class="audit-scroll"><table class="audit-table"><thead><tr><th>เวลา</th><th>รายการ / ตำแหน่ง</th><th>ผู้ทำ / เอกสาร</th><th>ยอดก่อน → หลัง</th></tr></thead><tbody>${shown.map(row => `<tr><td>${safe(new Date(row.occurred_at).toLocaleString('th-TH'))}</td><td><b>${safe(labels[row.action] || row.action)}</b><br>${safe(row.zone)} / ${safe(row.slot_code)}</td><td>${safe(row.actor_name)}<br><small>${safe(row.document_no)}</small></td><td>${changes(row)}</td></tr>`).join('')}</tbody></table></div>` : '<p>ไม่พบประวัติในข้อมูลที่โหลด</p>';
  }
  async function load(reset = false) {
    if (loading) return;
    if (!supabaseClient) { status.textContent = 'ยังไม่เชื่อมต่อฐานข้อมูล'; return; }
    loading = true; more.disabled = true; status.textContent = 'กำลังโหลดประวัติ…';
    try {
      let query = supabaseClient.from('pallet_audit_log').select('id,occurred_at,zone,slot_code,action,actor_name,document_no,before_items,after_items').order('id',{ascending:false}).limit(pageSize);
      if (!reset && cursor != null) query = query.lt('id',cursor);
      const {data,error} = await query;
      if (error) throw error;
      rows = reset ? data : rows.concat(data);
      cursor = rows.at(-1)?.id ?? null;
      more.hidden = data.length < pageSize;
      render();
    } catch (error) { status.textContent = 'โหลดประวัติไม่สำเร็จ: ' + error.message; }
    finally { loading = false; more.disabled = false; }
  }
  document.getElementById('palletAuditRefresh').addEventListener('click', () => load(true));
  more.addEventListener('click', () => load(false));
  search.addEventListener('input', render);
  document.getElementById('tab-audit').addEventListener('click', () => load(true));
})();
