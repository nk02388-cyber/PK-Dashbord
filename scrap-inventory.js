(() => {
  const root = document.getElementById('pane-scrap');
  if (!root || typeof ScrapInventoryCore === 'undefined') return;
  const form = document.getElementById('scrapForm');
  const zoneInput = document.getElementById('scrapZone');
  const slotInput = document.getElementById('scrapSlot');
  const productInput = document.getElementById('scrapProduct');
  const qtyInput = document.getElementById('scrapQty');
  const status = document.getElementById('scrapStatus');
  const preview = document.getElementById('scrapPreview');
  const history = document.getElementById('scrapHistory');
  const submit = document.getElementById('scrapSubmit');
  const escape = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmt = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:6});
  const zones = () => Object.keys(SLOT_ITEMS).filter(zone => Object.values(SLOT_ITEMS[zone] || {}).some(items => items.some(item => ScrapInventoryCore.quantity(item) > 0)))
    .sort((a,b) => a.localeCompare(b,'en',{numeric:true}));
  const chosenItems = () => SLOT_ITEMS[zoneInput.value]?.[slotInput.value] || [];
  const chosenItem = () => productInput.value === '' ? null : chosenItems()[Number(productInput.value)] || null;
  const setStatus = (message,error=false) => { status.textContent=message; status.classList.toggle('is-error',error); };
  const dateToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  function renderPreview() {
    const item=chosenItem();
    const available=item && ScrapInventoryCore.quantity(item);
    preview.innerHTML=item ? `<strong>${escape(item.code || 'ไม่ระบุรหัส')} · ${escape(item.name || 'ไม่ระบุชื่อ')}</strong>${item.lotNo ? ` · Lot ${escape(item.lotNo)}` : ''}<br><span>ต้นทาง ${escape(zoneInput.value)}/${escape(slotInput.value)} · คงเหลือในพาเลต ${available == null ? 'ไม่ทราบ' : fmt(available)} ${escape(item.unit || '')} · ปลายทางเสมือน Inventory Loss / Scrap</span>`
      : '<span>เลือกโซน ตำแหน่ง และสินค้าที่มียอดคงเหลือ เพื่อดูข้อมูลก่อนตัดจำหน่าย</span>';
    if (item && available != null) qtyInput.max=String(available);
    else qtyInput.removeAttribute('max');
  }
  function renderProducts() {
    const selected=productInput.value;
    productInput.innerHTML='<option value="">เลือกสินค้า</option>'+chosenItems().map((item,index) => {
      const available=ScrapInventoryCore.quantity(item);
      if (!(available > 0)) return '';
      return `<option value="${index}">${escape(item.code || 'ไม่ระบุรหัส')} · ${escape(item.name || 'ไม่ระบุชื่อ')}${item.lotNo ? ` · Lot ${escape(item.lotNo)}` : ''} · ${fmt(available)} ${escape(item.unit || '')}</option>`;
    }).join('');
    if ([...productInput.options].some(option=>option.value===selected)) productInput.value=selected;
    renderPreview();
  }
  function renderSlots() {
    const selected=slotInput.value;
    const slots=Object.entries(SLOT_ITEMS[zoneInput.value] || {}).filter(([,items])=>items.some(item=>ScrapInventoryCore.quantity(item)>0))
      .map(([slot])=>slot).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
    slotInput.innerHTML='<option value="">เลือกตำแหน่ง</option>'+slots.map(slot=>`<option value="${escape(slot)}">${escape(slot)}</option>`).join('');
    if (slots.includes(selected)) slotInput.value=selected;
    renderProducts();
  }
  function scrapRows() {
    const rows=[];
    for (const [zone,slots] of Object.entries(SLOT_ITEMS)) for (const [slot,items] of Object.entries(slots || {}))
      for (const item of items) for (const row of item.scraps || []) rows.push({ ...row,zone,slot,code:item.code || '',name:item.name || '',lotNo:row.lotNo || item.lotNo || '' });
    return rows.sort((a,b)=>String(b.recordedAt || b.date).localeCompare(String(a.recordedAt || a.date)));
  }
  function renderHistory() {
    const rows=scrapRows();
    document.getElementById('scrapExport').disabled=!rows.length;
    history.innerHTML=rows.length ? rows.slice(0,100).map(row=>`<tr><td>${escape(row.date)}</td><td>${escape(row.reference)}</td><td><strong>${escape(row.code)}</strong><small>${escape(row.name)}${row.lotNo ? ` · Lot ${escape(row.lotNo)}` : ''}</small></td><td>${escape(row.zone)}/${escape(row.slot)}</td><td>${fmt(row.qty)} ${escape(row.unit || '')}</td><td>${escape(row.reason)}${row.note ? `<small>${escape(row.note)}</small>` : ''}</td><td>${escape(row.by)}</td></tr>`).join('')
      : '<tr><td colspan="7">ยังไม่มีรายการ Scrap ในข้อมูลพาเลต</td></tr>';
  }
  function refresh() {
    const selected=zoneInput.value;
    const available=zones();
    zoneInput.innerHTML='<option value="">เลือกโซน</option>'+available.map(zone=>`<option value="${escape(zone)}">โซน ${escape(zone)}</option>`).join('');
    if (available.includes(selected)) zoneInput.value=selected;
    renderSlots(); renderHistory();
  }
  zoneInput.addEventListener('change',()=>{ slotInput.value=''; productInput.value=''; renderSlots(); });
  slotInput.addEventListener('change',()=>{ productInput.value=''; renderProducts(); });
  productInput.addEventListener('change',renderPreview);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (palletWriteBusy) { setStatus('กำลังบันทึกรายการอื่นอยู่ กรุณารอสักครู่',true); return; }
    if (!palletDataReady || !document.getElementById('syncStatusBar')?.classList.contains('sync-connected')) { setStatus('ข้อมูลพาเลตยังไม่เชื่อมต่อ กรุณารอหรือรีเฟรชก่อนทำรายการ',true); return; }
    const zone=zoneInput.value, slot=slotInput.value, index=Number(productInput.value), item=chosenItem();
    const details={qty:qtyInput.value,date:document.getElementById('scrapDate').value,reason:document.getElementById('scrapReason').value,
      document:document.getElementById('scrapDocument').value,actor:document.getElementById('scrapActor').value,note:document.getElementById('scrapNote').value};
    const error=ScrapInventoryCore.validate(item,details);
    if (!zone || !slot || productInput.value === '' || !item || error) { setStatus(error || 'กรุณาเลือกต้นทางและสินค้า',true); return; }
    if (!window.confirm(`ยืนยัน Scrap ${fmt(details.qty)} ${item.unit || ''} ของ ${item.code || item.name} จาก ${zone}/${slot}?\nเอกสาร ${details.document.trim()} · ${details.reason}`)) return;
    const before=buildSlotRow(zone,slot);
    const nextItems=JSON.parse(JSON.stringify(before.items));
    nextItems[index]=ScrapInventoryCore.prepare(nextItems[index],details);
    const expected=palletVersions.get(JSON.stringify([zone,slot])) || 0;
    palletWriteBusy=true; submit.disabled=true; setStatus('กำลังบันทึกและตรวจสอบเวอร์ชันพาเลต…');
    try {
      await savePalletBatch([{...before,items:nextItems,expected_version:expected}],[],{
        action:'adjust',document_no:details.document.trim(),actor:details.actor.trim()
      });
      setStatus(`บันทึก Scrap ${fmt(details.qty)} ${item.unit || ''} จาก ${zone}/${slot} แล้ว · คงเหลือ ${fmt(nextItems[index].remainingQty)} ${item.unit || ''}`);
      qtyInput.value=''; document.getElementById('scrapReason').value=''; document.getElementById('scrapNote').value='';
      refresh();
      if (typeof syncAfterSlotEdit === 'function') syncAfterSlotEdit();
    } catch(err) { setStatus(err.message || 'บันทึก Scrap ไม่สำเร็จ',true); }
    finally { palletWriteBusy=false; submit.disabled=false; }
  });
  document.getElementById('scrapExport').addEventListener('click',()=>{
    const header=['วันที่','เลขเอกสาร','โซน','ตำแหน่ง','รหัสสินค้า','ชื่อสินค้า','Lot','จำนวน','หน่วย','เหตุผล','รายละเอียด','ผู้ทำรายการ','บันทึกเมื่อ','ปลายทาง'];
    const rows=scrapRows().map(row=>[row.date,row.reference,row.zone,row.slot,row.code,row.name,row.lotNo,row.qty,row.unit,row.reason,row.note,row.by,row.recordedAt,row.destination]);
    const cell=value=>{const raw=String(value ?? '');const safe=typeof value!=='number' && /^[=+@\-\t\r]/.test(raw)?`'${raw}`:raw;return `"${safe.replace(/"/g,'""')}"`;};
    const csv='\ufeff'+[header,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`scrap-inventory-${dateToday()}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.getElementById('tab-scrap').addEventListener('click',refresh);
  document.getElementById('scrapDate').value=dateToday();
  try { document.getElementById('scrapActor').value=localStorage.getItem('palletAuditActor') || ''; } catch(_) {}
  window.PKScrapInventory={refresh};
  refresh();
})();
