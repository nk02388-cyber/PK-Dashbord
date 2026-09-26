(function (root) {
  'use strict';

  const storageKey = 'pk-event-calendar-v1';
  const migratedKey = 'pk-event-calendar-migrated-v1';
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const validLeads = new Set([0,15,60,1440,10080]);
  function eventTime(event) {
    const value = String(event?.date || '') + 'T' + String(event?.time || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const time = new Date(value);
    return Number.isNaN(time.getTime()) || dateKey(time) !== event.date ||
      `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}` !== event.time ? null : time;
  }
  function cleanEvents(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(event => event && typeof event.id === 'string' &&
      typeof event.name === 'string' && event.name.trim() && eventTime(event))
      .map(event => ({id:event.id,name:event.name.trim().slice(0,120),date:event.date,time:event.time,
        lead:validLeads.has(Number(event.lead)) ? Number(event.lead) : 1440,
        details:String(event.details || '').slice(0,500)}))
      .sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.name.localeCompare(b.name,'th'));
  }
  function dueEvents(events, now = new Date()) {
    const current = now.getTime();
    return cleanEvents(events).filter(event => {
      const start = eventTime(event).getTime();
      return current >= start - event.lead * 60000 && current < start + 3600000;
    });
  }
  function upcomingEvents(events, now = new Date(), days = 7) {
    const current = now.getTime(), end = current + days * 86400000;
    return cleanEvents(events).filter(event => {
      const start = eventTime(event).getTime();
      return start >= current && start <= end;
    });
  }
  const fromRow = row => ({id:row.id,name:row.name,date:row.event_date,time:String(row.event_time || '').slice(0,5),lead:row.lead_minutes,details:row.details || ''});
  const toParams = (event,expectedVersion) => ({p_id:event.id,p_name:event.name,p_date:event.date,p_time:event.time,p_lead:event.lead,p_details:event.details,p_expected_version:expectedVersion});
  const api = {dateKey,eventTime,cleanEvents,dueEvents,upcomingEvents,fromRow,toParams};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  const dialog = document.getElementById('eventCalendarDialog');
  if (!dialog) return;
  const byId = id => document.getElementById(id);
  const escape = value => escapeHtml(String(value ?? ''));
  const dateFormat = new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'});
  const monthFormat = new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'});
  const names = ['จ','อ','พ','พฤ','ศ','ส','อา'];
  const form = byId('eventCalendarForm');
  const error = byId('eventCalendarError');
  const grid = byId('eventCalendarGrid');
  const agenda = byId('eventCalendarAgenda');
  const badge = byId('eventCalendarBadge');
  const syncStatus = byId('eventCalendarSync');
  const saveButton = form.querySelector('.event-calendar-save');
  const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  let events = [];
  let versions = new Map();
  let syncState = 'connecting';
  let busy = false;
  let refreshId = 0;
  let editingVersion = 0;
  let selected = dateKey(new Date());
  let view = new Date(new Date().getFullYear(),new Date().getMonth(),1);

  function readLegacy() {
    try { return cleanEvents(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
    catch { return []; }
  }
  function setSyncState(state,message) {
    syncState = state;
    syncStatus.dataset.state = state;
    syncStatus.textContent = message;
    saveButton.disabled = state !== 'ready' || busy;
    render();
  }
  function showError(message) { error.textContent = message; error.hidden = false; }
  async function fetchRows() {
    if (!client) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
    const result=[];
    for (let offset=0;offset<100000;offset+=500) {
      const {data,error:fetchError}=await client.from('event_calendar')
        .select('id,name,event_date,event_time,lead_minutes,details,version,updated_at')
        .order('event_date',{ascending:true}).order('event_time',{ascending:true}).order('id',{ascending:true})
        .range(offset,offset+499);
      if (fetchError) throw fetchError;
      result.push(...(data || []));
      if (!data || data.length<500) return result;
    }
    throw new Error('รายการนัดหมายมากเกินช่วงที่รองรับ');
  }
  async function migrateLegacy() {
    try { if (localStorage.getItem(migratedKey) === '1') return; } catch (_) { return; }
    const legacy = readLegacy();
    for (const event of legacy) {
      const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id) ? event.id : root.crypto.randomUUID();
      const {error:saveError}=await client.rpc('save_calendar_event',toParams({...event,id},0));
      if (saveError && saveError.code !== '40001') throw saveError;
    }
    try { localStorage.setItem(migratedKey,'1'); } catch (_) {}
  }
  async function refreshRemote({migrate=false}={}) {
    const request=++refreshId;
    try {
      let rows=await fetchRows();
      if (migrate) { await migrateLegacy(); rows=await fetchRows(); }
      if (request!==refreshId) return;
      events=cleanEvents(rows.map(fromRow));
      versions=new Map(rows.map(row=>[row.id,Number(row.version)]));
      try { localStorage.setItem(storageKey,JSON.stringify(events)); } catch (_) {}
      setSyncState('ready','ซิงค์ทุกเครื่องแล้ว · กำลังแสดงข้อมูลล่าสุด');
      notifyChange();
    } catch (fetchError) {
      if (request!==refreshId) return;
      setSyncState('error','ซิงค์ไม่ได้ · กำลังแสดงข้อมูลที่บันทึกไว้ในเครื่องนี้');
      if (dialog.open) showError(`โหลดปฏิทินไม่สำเร็จ: ${fetchError.message || 'กรุณาลองใหม่'}`);
      notifyChange();
    }
  }
  function notifyChange() {
    render();
    root.PKNotifications?.refreshStock();
  }
  function render() {
    const today = dateKey(new Date());
    const upcoming = upcomingEvents(events);
    badge.hidden = !upcoming.length;
    badge.textContent = upcoming.length > 9 ? '9+' : String(upcoming.length);
    byId('eventCalendarMonth').textContent = monthFormat.format(view);
    const firstOffset = (view.getDay()+6)%7;
    const first = new Date(view.getFullYear(),view.getMonth(),1-firstOffset);
    const last = new Date(view.getFullYear(),view.getMonth()+1,0);
    const cells = Math.ceil((firstOffset+last.getDate())/7)*7;
    grid.innerHTML = names.map(name => `<span class="event-calendar-weekday">${name}</span>`).join('') +
      Array.from({length:cells},(_,index) => {
        const day = new Date(first.getFullYear(),first.getMonth(),first.getDate()+index);
        const key = dateKey(day), count = events.filter(event => event.date === key).length;
        return `<button type="button" class="event-calendar-day${day.getMonth() === view.getMonth() ? '' : ' outside'}${key === today ? ' today' : ''}${key === selected ? ' selected' : ''}" data-day="${key}" aria-label="${escape(dateFormat.format(day))}${count ? ` · ${count} กิจกรรม` : ''}" aria-pressed="${key === selected}"><span>${day.getDate()}</span>${count ? `<small>${count}</small>` : ''}</button>`;
      }).join('');
    const selectedDate = new Date(selected+'T12:00');
    byId('eventCalendarSelectedHeading').textContent = `กิจกรรมวันที่ ${dateFormat.format(selectedDate)}`;
    const selectedEvents = events.filter(event => event.date === selected);
    agenda.innerHTML = selectedEvents.length ? selectedEvents.map(event => `<article class="event-calendar-entry"><div><strong>${escape(event.time)} · ${escape(event.name)}</strong>${event.details ? `<p>${escape(event.details)}</p>` : ''}<small>เตือน${event.lead === 0 ? 'เมื่อถึงเวลา' : `ล่วงหน้า ${event.lead === 15 ? '15 นาที' : event.lead === 60 ? '1 ชั่วโมง' : event.lead === 1440 ? '1 วัน' : '7 วัน'}`}</small></div><div class="event-calendar-entry-actions"><button type="button" data-edit="${escape(event.id)}" ${syncState === 'ready' && !busy ? '' : 'disabled'}>แก้ไข</button><button type="button" data-delete="${escape(event.id)}" ${syncState === 'ready' && !busy ? '' : 'disabled'}>ลบ</button></div></article>`).join('') : '<p class="event-calendar-empty">ยังไม่มีกิจกรรมในวันนี้</p>';
  }
  function resetForm() {
    form.reset();
    byId('eventCalendarId').value = '';
    editingVersion = 0;
    byId('eventCalendarDate').value = selected;
    byId('eventCalendarTime').value = '09:00';
    byId('eventCalendarLead').value = '1440';
    byId('eventCalendarFormHeading').textContent = 'เพิ่มกิจกรรม';
    byId('eventCalendarCancel').hidden = true;
    error.hidden = true;
    saveButton.disabled = syncState !== 'ready' || busy;
  }
  function open(id) {
    const event = events.find(item => item.id === id);
    if (event) { selected = event.date; view = new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,1); }
    render(); resetForm();
    if (!dialog.open) dialog.showModal();
    if (event) edit(event);
  }
  function edit(event) {
    byId('eventCalendarId').value = event.id;
    editingVersion = versions.get(event.id) || 0;
    byId('eventCalendarName').value = event.name;
    byId('eventCalendarDate').value = event.date;
    byId('eventCalendarTime').value = event.time;
    byId('eventCalendarLead').value = String(event.lead);
    byId('eventCalendarDetails').value = event.details;
    byId('eventCalendarFormHeading').textContent = 'แก้ไขกิจกรรม';
    byId('eventCalendarCancel').hidden = false;
    byId('eventCalendarName').focus();
  }
  events = readLegacy();
  byId('eventCalendarToggle').addEventListener('click',() => { open(); if (syncState !== 'connecting') refreshRemote(); });
  byId('eventCalendarClose').addEventListener('click',() => dialog.close());
  dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); });
  byId('eventCalendarPrev').addEventListener('click',() => { view = new Date(view.getFullYear(),view.getMonth()-1,1); render(); });
  byId('eventCalendarNext').addEventListener('click',() => { view = new Date(view.getFullYear(),view.getMonth()+1,1); render(); });
  byId('eventCalendarToday').addEventListener('click',() => { selected = dateKey(new Date()); view = new Date(new Date().getFullYear(),new Date().getMonth(),1); resetForm(); render(); });
  grid.addEventListener('click',event => {
    const key = event.target.closest('[data-day]')?.dataset.day;
    if (!key) return;
    selected = key; view = new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1);
    resetForm(); render();
  });
  agenda.addEventListener('click',async event => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    if (editId) { const item = events.find(row => row.id === editId); if (item) edit(item); return; }
    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;
    const item = events.find(row => row.id === deleteId);
    if (!item || syncState !== 'ready' || busy || !confirm(`ลบกิจกรรม “${item.name}” หรือไม่?`)) return;
    busy=true; setSyncState('ready','กำลังลบกิจกรรม…');
    try {
      const {error:deleteError}=await client.rpc('delete_calendar_event',{p_id:deleteId,p_expected_version:versions.get(deleteId)});
      if (deleteError) throw deleteError;
      if (byId('eventCalendarId').value === deleteId) resetForm();
      await refreshRemote();
    } catch (deleteError) {
      showError(deleteError.code === '40001' ? 'กิจกรรมถูกแก้ไขจากเครื่องอื่นแล้ว กรุณาตรวจข้อมูลล่าสุด' : `ลบกิจกรรมไม่สำเร็จ: ${deleteError.message}`);
      await refreshRemote();
    } finally { busy=false; setSyncState(syncState,syncStatus.textContent); }
  });
  byId('eventCalendarCancel').addEventListener('click',resetForm);
  form.addEventListener('submit',async event => {
    event.preventDefault(); error.hidden = true;
    if (syncState !== 'ready' || busy) { showError('ยังซิงค์ปฏิทินไม่ได้ กรุณารอหรือลองใหม่'); return; }
    const entry = {id:byId('eventCalendarId').value || root.crypto.randomUUID(),
      name:byId('eventCalendarName').value.trim(),date:byId('eventCalendarDate').value,time:byId('eventCalendarTime').value,
      lead:Number(byId('eventCalendarLead').value),details:byId('eventCalendarDetails').value.trim()};
    if (!entry.name || !eventTime(entry) || !validLeads.has(entry.lead)) {
      showError('กรุณาระบุชื่อ วันที่ และเวลาที่ถูกต้อง'); return;
    }
    busy=true; setSyncState('ready','กำลังบันทึกกิจกรรม…');
    try {
      const {error:saveError}=await client.rpc('save_calendar_event',toParams(entry,editingVersion));
      if (saveError) throw saveError;
      selected = entry.date;
      view = new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,1);
      resetForm();
      await refreshRemote();
    } catch (saveError) {
      showError(saveError.code === '40001' ? 'กิจกรรมถูกแก้ไขจากเครื่องอื่นแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนบันทึกอีกครั้ง' : `บันทึกกิจกรรมไม่สำเร็จ: ${saveError.message}`);
      await refreshRemote();
    } finally { busy=false; setSyncState(syncState,syncStatus.textContent); }
  });
  root.addEventListener('storage',event => { if (event.key === storageKey && syncState !== 'ready') { events = readLegacy(); notifyChange(); } });
  document.addEventListener('visibilitychange',() => { if (!document.hidden) refreshRemote(); });
  setInterval(() => { if (!document.hidden) refreshRemote(); else notifyChange(); },30000);
  api.getDue = () => syncState === 'ready' ? dueEvents(events) : [];
  api.open = open;
  root.PKEvents = api;
  render();
  refreshRemote({migrate:true});
  if (client?.channel) client.channel('bcl-event-calendar').on('postgres_changes',{event:'*',schema:'public',table:'event_calendar'},() => refreshRemote()).subscribe();
})(typeof window !== 'undefined' ? window : globalThis);
