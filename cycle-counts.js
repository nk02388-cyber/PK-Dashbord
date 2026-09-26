(() => {
  const root = document.getElementById('pane-cycle-counts');
  if (!root || typeof CycleCountCore === 'undefined') return;

  const storageKey = 'bcl-cycle-counts-v1';
  const zoneSelect = document.getElementById('cycleCountZone');
  const frequencyInput = document.getElementById('cycleCountFrequency');
  const scheduleBody = document.getElementById('cycleCountSchedule');
  const summaryBox = document.getElementById('cycleCountSummary');
  const draftBox = document.getElementById('cycleCountDraft');
  const historyBox = document.getElementById('cycleCountHistory');
  const statusBox = document.getElementById('cycleCountStatus');
  const badge = document.getElementById('tabBadgeCycleCounts');
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
  const dateLabel = iso => iso ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T12:00:00`)) : '—';
  const zones = Object.keys(ZONE_SLOTS).filter(zone => ZONE_SLOTS[zone]?.length).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return { frequency: parsed.frequency && typeof parsed.frequency === 'object' ? parsed.frequency : {},
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 100) : [],
        draft: parsed.draft && typeof parsed.draft === 'object' ? parsed.draft : null };
    } catch (_) { return { frequency: {}, history: [], draft: null }; }
  }
  let state = loadState();
  function persist(nextState) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextState));
      state = nextState;
      return true;
    } catch (_) {
      setStatus('บันทึกในเบราว์เซอร์ไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บหรือสิทธิ์การใช้งาน', true);
      return false;
    }
  }
  function setStatus(message, error = false) {
    statusBox.textContent = message;
    statusBox.classList.toggle('is-error', error);
  }
  function lastFor(zone) { return state.history.find(record => record.zone === zone) || null; }
  function zoneFrequency(zone) { return Number(state.frequency[zone]) || 0; }
  function renderSchedule() {
    let due = 0, configured = 0;
    scheduleBody.innerHTML = zones.map(zone => {
      const frequency = zoneFrequency(zone);
      const last = lastFor(zone);
      const schedule = CycleCountCore.scheduleStatus(last?.completedAt?.slice(0, 10), frequency);
      if (frequency > 0) configured += 1;
      if (schedule.kind === 'due' || schedule.kind === 'overdue') due += 1;
      return `<tr class="${zone === zoneSelect.value ? 'is-selected' : ''}">
        <td><button type="button" class="cycle-zone-link" data-zone="${esc(zone)}">โซน ${esc(zone)}</button></td>
        <td>${number(ZONE_SLOTS[zone].length)}</td><td>${frequency ? `ทุก ${number(frequency)} วัน` : '—'}</td>
        <td>${dateLabel(last?.completedAt?.slice(0, 10))}</td><td>${schedule.next ? dateLabel(schedule.next) : '—'}</td>
        <td><span class="cycle-status cycle-status-${schedule.kind}">${schedule.label}</span></td>
      </tr>`;
    }).join('');
    badge.textContent = due ? `${due} ถึงกำหนด` : configured ? 'ตามกำหนด' : 'ตั้งรอบนับ';
    summaryBox.innerHTML = `<div><strong>${zones.length}</strong><span>โซนที่มีตำแหน่งพาเลต</span></div><div><strong>${configured}</strong><span>ตั้งรอบนับแล้ว</span></div><div><strong>${due}</strong><span>ถึงกำหนด / เกินกำหนด</span></div><div><strong>${state.history.length}</strong><span>ผลนับในเครื่องนี้</span></div>`;
  }
  function difference(row) {
    if (row.counted === '' || row.counted == null || row.expected == null) return '—';
    const delta = Number(row.counted) - Number(row.expected);
    return `${delta > 0 ? '+' : ''}${number(delta)} ${row.unit}`;
  }
  function renderDraft() {
    const draft = state.draft;
    draftBox.hidden = !draft;
    if (!draft) { draftBox.innerHTML = ''; return; }
    const tally = CycleCountCore.countSummary(draft.rows);
    draftBox.innerHTML = `<div class="cycle-counts-draft-head"><div><h3>กำลังตรวจนับโซน ${esc(draft.zone)}</h3><p>บันทึกยอดตั้งต้นเมื่อ ${esc(new Date(draft.startedAt).toLocaleString('th-TH'))} · ${draft.rows.length} รายการ</p></div><button id="cycleCountCancel" type="button">ยกเลิกงานนับ</button></div>
      <div class="cycle-counts-draft-meta"><label>ผู้ตรวจนับ *<input id="cycleCountBy" maxlength="80" autocomplete="name" value="${esc(draft.countedBy || '')}"></label><label>หมายเหตุ<input id="cycleCountNote" maxlength="500" value="${esc(draft.note || '')}" placeholder="เลขเอกสารหรือข้อสังเกต (ถ้ามี)"></label></div>
      ${draft.rows.length ? `<div class="cycle-counts-table-wrap cycle-counts-entry-table"><table><thead><tr><th>ตำแหน่ง</th><th>สินค้า / Lot</th><th>ยอดในระบบ</th><th>นับได้ *</th><th>ส่วนต่าง</th></tr></thead><tbody>${draft.rows.map((row, index) => `<tr><td>${esc(row.slot)}</td><td><strong>${esc(row.code || 'ไม่ระบุรหัส')}</strong><span>${esc(row.name)}</span>${row.lot ? `<small>Lot ${esc(row.lot)}</small>` : ''}</td><td>${row.expected == null ? 'ไม่ทราบ' : `${number(row.expected)} ${esc(row.unit)}`}</td><td><input type="number" min="0" ${row.type === 'occupied' ? 'max="1" step="1"' : 'step="any"'} inputmode="decimal" data-row="${index}" aria-label="จำนวนที่นับได้ ${esc(row.slot)} ${esc(row.code || row.name)}" value="${esc(row.counted)}"></td><td class="cycle-difference" data-difference="${index}">${esc(difference(row))}</td></tr>`).join('')}</tbody></table></div>` : `<label class="cycle-counts-empty-confirm"><input id="cycleCountConfirmEmpty" type="checkbox" ${draft.confirmEmpty ? 'checked' : ''}> ตรวจแล้วว่าโซนนี้ไม่มีสินค้าและไม่มีพาเลตใช้งาน</label>`}
      <div class="cycle-counts-draft-foot"><span id="cycleCountProgress">กรอกแล้ว ${tally.counted}/${draft.rows.length} · ส่วนต่าง ${tally.different} · ไม่ทราบยอดตั้งต้น ${tally.unknown}</span><button id="cycleCountComplete" type="button" class="cycle-counts-primary">บันทึกผลตรวจนับ</button></div>`;
  }
  function renderHistory() {
    document.getElementById('cycleCountExport').disabled = !state.history.length;
    if (!state.history.length) { historyBox.textContent = 'ยังไม่มีผลตรวจนับในเครื่องนี้'; return; }
    historyBox.innerHTML = state.history.slice(0, 20).map(record => {
      const tally = CycleCountCore.countSummary(record.rows);
      return `<details><summary><strong>โซน ${esc(record.zone)}</strong> · ${esc(new Date(record.completedAt).toLocaleString('th-TH'))} · ${esc(record.countedBy)} · ส่วนต่าง ${tally.different} รายการ</summary><p>${record.rows.length} รายการ · ไม่ทราบยอดตั้งต้น ${tally.unknown} รายการ${record.note ? ` · ${esc(record.note)}` : ''}</p><div class="cycle-counts-table-wrap"><table><thead><tr><th>ตำแหน่ง</th><th>สินค้า</th><th>ยอดในระบบ</th><th>นับได้</th><th>ส่วนต่าง</th></tr></thead><tbody>${record.rows.map(row => `<tr><td>${esc(row.slot)}</td><td>${esc(row.code || row.name)}</td><td>${row.expected == null ? 'ไม่ทราบ' : number(row.expected)} ${esc(row.unit)}</td><td>${number(row.counted)} ${esc(row.unit)}</td><td>${esc(difference(row))}</td></tr>`).join('')}</tbody></table></div></details>`;
    }).join('');
  }
  function refresh() { renderSchedule(); renderDraft(); renderHistory(); }

  zoneSelect.innerHTML = zones.map(zone => `<option value="${esc(zone)}">โซน ${esc(zone)} · ${number(ZONE_SLOTS[zone].length)} ตำแหน่ง</option>`).join('');
  zoneSelect.addEventListener('change', () => { frequencyInput.value = zoneFrequency(zoneSelect.value); renderSchedule(); });
  document.getElementById('cycleCountSaveFrequency').addEventListener('click', () => {
    const days = Number(frequencyInput.value);
    if (!Number.isInteger(days) || days < 0 || days > 3650 || frequencyInput.value.trim() === '') { setStatus('รอบนับต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 3,650 วัน', true); return; }
    if (persist({ ...state, frequency: { ...state.frequency, [zoneSelect.value]: days } })) {
      setStatus(`บันทึกรอบนับโซน ${zoneSelect.value} แล้ว${days ? ` · ทุก ${days} วัน` : ' · ไม่ตั้งรอบ'}`);
      renderSchedule();
    }
  });
  document.getElementById('cycleCountStart').addEventListener('click', () => {
    if (state.draft) { setStatus(`มีงานตรวจนับโซน ${state.draft.zone} ค้างอยู่ กรุณาบันทึกผลหรือยกเลิกก่อน`, true); draftBox.scrollIntoView({ block: 'start' }); return; }
    if (!palletDataReady || !document.getElementById('syncStatusBar')?.classList.contains('sync-connected')) {
      setStatus('ข้อมูลพาเลตยังไม่เชื่อมต่อเรียลไทม์ กรุณารอหรือรีเฟรชหน้าเว็บก่อนเริ่มตรวจนับ', true); return;
    }
    const zone = zoneSelect.value;
    const snapshot = CycleCountCore.snapshotZone(zone, ZONE_SLOTS[zone], SLOT_ITEMS[zone], PALLET_STATUS[zone], getRemainingQty);
    if (persist({ ...state, draft: { zone, startedAt: new Date().toISOString(), countedBy: '', note: '', confirmEmpty: false, rows: snapshot.rows } })) {
      setStatus(`เริ่มตรวจนับโซน ${zone} แล้ว กรอกจำนวนจริงทุกตำแหน่งก่อนบันทึกผล`);
      renderDraft(); draftBox.scrollIntoView({ block: 'start' });
    }
  });
  scheduleBody.addEventListener('click', event => {
    const button = event.target.closest('[data-zone]');
    if (!button) return;
    zoneSelect.value = button.dataset.zone;
    frequencyInput.value = zoneFrequency(zoneSelect.value);
    renderSchedule();
    zoneSelect.focus();
  });
  draftBox.addEventListener('input', event => {
    if (!state.draft) return;
    const target = event.target;
    if (target.id === 'cycleCountBy') state.draft.countedBy = target.value;
    else if (target.id === 'cycleCountNote') state.draft.note = target.value;
    else if (target.dataset.row != null) {
      const row = state.draft.rows[Number(target.dataset.row)];
      if (!row) return;
      row.counted = target.value;
      const differenceCell = draftBox.querySelector(`[data-difference="${target.dataset.row}"]`);
      if (differenceCell) differenceCell.textContent = difference(row);
    } else return;
    const tally = CycleCountCore.countSummary(state.draft.rows);
    draftBox.querySelector('#cycleCountProgress').textContent = `กรอกแล้ว ${tally.counted}/${state.draft.rows.length} · ส่วนต่าง ${tally.different} · ไม่ทราบยอดตั้งต้น ${tally.unknown}`;
    persist(state);
  });
  draftBox.addEventListener('change', event => {
    if (event.target.id !== 'cycleCountConfirmEmpty' || !state.draft) return;
    state.draft.confirmEmpty = event.target.checked;
    persist(state);
  });
  draftBox.addEventListener('click', event => {
    if (event.target.id === 'cycleCountCancel') {
      if (!window.confirm('ยกเลิกงานตรวจนับที่ยังไม่บันทึกผลหรือไม่?')) return;
      if (persist({ ...state, draft: null })) { renderDraft(); setStatus('ยกเลิกงานตรวจนับแล้ว'); }
    }
    if (event.target.id === 'cycleCountComplete') {
      const draft = state.draft;
      const error = CycleCountCore.countError(draft);
      if (error) { setStatus(error, true); return; }
      const completed = { ...draft, completedAt: new Date().toISOString(), rows: draft.rows.map(row => ({ ...row, counted: Number(row.counted) })) };
      delete completed.confirmEmpty;
      if (persist({ ...state, draft: null, history: [completed, ...state.history].slice(0, 100) })) {
        refresh();
        setStatus(`บันทึกผลตรวจนับโซน ${completed.zone} แล้ว · ผลต่าง ${CycleCountCore.countSummary(completed.rows).different} รายการ · ยอดสต็อกจริงยังไม่ถูกปรับ`);
      }
    }
  });
  document.getElementById('cycleCountExport').addEventListener('click', () => {
    const header = ['โซน', 'เริ่มนับ', 'บันทึกผล', 'ผู้ตรวจนับ', 'ตำแหน่ง', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot', 'หน่วย', 'ยอดในระบบ', 'นับได้', 'ส่วนต่าง', 'หมายเหตุ'];
    const rows = state.history.flatMap(record => (record.rows.length ? record.rows : [{ slot: '', code: '', name: 'ยืนยันว่าไม่มีสินค้า', lot: '', unit: '', expected: 0, counted: 0 }]).map(row => [record.zone, record.startedAt, record.completedAt, record.countedBy, row.slot, row.code, row.name, row.lot, row.unit, row.expected ?? '', row.counted, row.expected == null ? '' : Number(row.counted) - Number(row.expected), record.note || '']));
    const csvCell = value => { const text = String(value ?? ''); const safe = typeof value !== 'number' && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
    const csv = '\ufeff' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `cycle-counts-${CycleCountCore.todayIso()}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('tab-cycle-counts').addEventListener('click', () => { renderSchedule(); });
  window.addEventListener('storage', event => { if (event.key === storageKey) { state = loadState(); frequencyInput.value = zoneFrequency(zoneSelect.value); refresh(); } });
  window.PKCycleCounts = { refresh: renderSchedule };
  frequencyInput.value = zoneFrequency(zoneSelect.value);
  refresh();
})();
