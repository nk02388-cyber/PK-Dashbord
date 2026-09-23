// Two-stage FM-ST-011 / FM-ST-019 flow. A receiving scan never changes pallet stock.
(() => {
  const $ = id => document.getElementById(id);
  const locations = Object.entries(ZONE_SLOTS).flatMap(([zone,slots]) => slots.map(slot => ({zone,slot:slot.code})));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const status = (id,text,error=false) => { $(id).textContent=text; $(id).dataset.error=String(error); };
  const today = new Date();
  $('incomingReceivedOn').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  let selectedProduct=null, selectedTag=null, selectedLocation=null, lastCreated=null, pendingCreateRequestId=null;
  let camera=null, cameraStarting=false, cameraRunning=false, cameraGeneration=0, scanning=false, saving=false;
  let scanAudio=null,lastScanSoundKey='',lastScanSoundAt=0;
  function armScanAudio() {
    try {
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if (!AudioContextClass) return null;
      scanAudio ||= new AudioContextClass();
      if (scanAudio.state==='suspended') scanAudio.resume().catch(()=>{});
      return scanAudio;
    } catch (_) { return null; }
  }
  function playScanSuccess(key) {
    const audio=armScanAudio();
    if (!audio) return;
    if (audio.state!=='running') {
      audio.resume().then(()=>{if(audio.state==='running') playScanSuccess(key);}).catch(()=>{});
      return;
    }
    const nowMs=Date.now();
    if (key===lastScanSoundKey&&nowMs-lastScanSoundAt<600) return;
    try {
      const tone=audio.createOscillator(),volume=audio.createGain(),now=audio.currentTime;
      tone.type='sine';
      tone.frequency.setValueAtTime(880,now);
      tone.frequency.setValueAtTime(1175,now+0.075);
      volume.gain.setValueAtTime(0.0001,now);
      volume.gain.exponentialRampToValueAtTime(0.12,now+0.012);
      volume.gain.exponentialRampToValueAtTime(0.0001,now+0.17);
      tone.connect(volume);volume.connect(audio.destination);
      tone.start(now);tone.stop(now+0.18);
      lastScanSoundKey=key;lastScanSoundAt=nowMs;
    } catch (_) {} // Scanning must continue if sound is unavailable.
  }
  function products() {
    return [...(STOCK.items||[]),...Object.values(SLOT_ITEMS).flatMap(slots=>Object.values(slots).flat())];
  }
  function identifyProduct(rawScan=false) {
    const raw=$('incomingProductCode').value.trim();
    selectedProduct=PKIncoming.exactProduct(raw,products());
    $('incomingProductName').value=selectedProduct?.name||'';
    if (selectedProduct) {
      if (rawScan) playScanSuccess(`product:${selectedProduct.code}`);
      $('incomingProductCode').value=selectedProduct.code;
      if (!$('incomingUnit').value) $('incomingUnit').value=selectedProduct.unit||'';
      status('incomingReceiveStatus',`พบสินค้า ${selectedProduct.code} · ${selectedProduct.name||''}`);
    } else if (raw) status('incomingReceiveStatus','ไม่พบรหัสสินค้าตรงตัวในสต็อกที่อัปเดต',true);
    return selectedProduct;
  }
  $('incomingProductCode').addEventListener('change',()=>{armScanAudio();identifyProduct(true);});
  $('incomingProductCode').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();armScanAudio();identifyProduct(true);$('incomingQuantity').focus();}});
  $('incomingProductCode').addEventListener('input',()=>{selectedProduct=null;$('incomingProductName').value='';});
  function renderTag(tag) {
    if (!tag) return;
    lastCreated=tag;
    $('incomingTagReady').hidden=false;
    $('incomingTagReady').innerHTML=`<b>FM-ST-019 · ${esc(tag.receiving_no)} / ${esc(tag.running_no)}</b><br>${esc(tag.product_code)} · ${esc(tag.product_name)}<br>${esc(tag.quantity)} ${esc(tag.unit)} · Lot ${esc(tag.lot_no||'—')}<br>QR: ${esc(PKIncoming.tagPayload(tag.id))}`;
    $('incomingPrintTag').hidden=false;
  }
  async function refreshList() {
    if (!supabaseClient) { status('incomingListStatus','ยังไม่ได้เชื่อมต่อฐานข้อมูล',true); return; }
    const {data,error}=await supabaseClient.from('incoming_pallets').select('*').order('received_at',{ascending:false}).limit(100);
    if (error) {
      status('incomingListStatus',error.code==='42P01'||error.code==='PGRST205'
        ? 'ยังไม่มีตารางรับเข้าในฐานข้อมูล · ต้องติดตั้ง supabase-incoming.sql ก่อนใช้งาน'
        : 'โหลดรายการรับเข้าไม่ได้: '+error.message,true);
      $('incomingList').replaceChildren(); return;
    }
    const rows=data||[];
    $('tabBadgeIncoming').textContent=`${rows.filter(row=>row.status==='pending').length} รอจัดเก็บ`;
    status('incomingListStatus',`แสดง ${rows.length} ป้ายล่าสุด · รอจัดเก็บ ${rows.filter(row=>row.status==='pending').length} ป้าย`);
    $('incomingList').innerHTML=rows.length?`<table><thead><tr><th>FM-ST-011 / ลำดับป้าย</th><th>สินค้า</th><th>จำนวนต่อพาเลต</th><th>สถานะ / Location</th><th>ป้าย FM-ST-019</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.receiving_no)} / ${esc(row.running_no)}</td><td>${esc(row.product_code)}<br>${esc(row.product_name)}</td><td>${esc(row.quantity)} ${esc(row.unit)}</td><td>${row.status==='stored'?`จัดเก็บ ${esc(row.zone)}/${esc(row.slot_code)}`:'รอจัดเก็บ'}</td><td><button type="button" data-print-tag="${esc(row.id)}">พิมพ์ QR</button> ${row.status==='pending'?`<button type="button" data-select-tag="${esc(row.id)}">เลือกจัดเก็บ</button>`:''}</td></tr>`).join('')}</tbody></table>`:'ยังไม่มีป้ายรับเข้า';
    $('incomingList')._rows=rows;
  }
  function updatePutaway() {
    $('incomingPutawaySummary').innerHTML=selectedTag
      ? `<b>FM-ST-019 · ${esc(selectedTag.receiving_no)} / ${esc(selectedTag.running_no)}</b><br>${esc(selectedTag.product_code)} · ${esc(selectedTag.product_name)} · ${esc(selectedTag.quantity)} ${esc(selectedTag.unit)}<br>Location: ${selectedLocation?`${esc(selectedLocation.zone)}/${esc(selectedLocation.slot)}`:'ยังไม่สแกน'}`
      : 'ยังไม่ได้เลือกป้ายพาเลตและ Location';
    $('incomingPutaway').disabled=!(selectedTag?.status==='pending'&&selectedLocation&&$('incomingStorer').value.trim()&&!saving);
  }
  async function selectTag(raw,rawScan=false) {
    const id=PKIncoming.parseTag(raw);
    if (!id) {selectedTag=null;updatePutaway();status('incomingPutawayStatus','QR ป้ายพาเลตไม่ถูกต้อง · ต้องเป็น PKTAG',true);return;}
    if (!supabaseClient) {status('incomingPutawayStatus','ยังไม่ได้เชื่อมต่อฐานข้อมูล',true);return;}
    const {data,error}=await supabaseClient.from('incoming_pallets').select('*').eq('id',id).single();
    if (error||!data) {selectedTag=null;updatePutaway();status('incomingPutawayStatus','ไม่พบป้ายพาเลตนี้ในทะเบียนรับเข้า',true);return;}
    selectedTag=data; $('incomingTagScan').value=PKIncoming.tagPayload(id);
    if (rawScan&&data.status==='pending') playScanSuccess(`tag:${data.id}`);
    updatePutaway();
    status('incomingPutawayStatus',data.status==='pending'?'อ่านป้ายแล้ว · สแกน Location เพื่อจัดเก็บ':`ป้ายนี้จัดเก็บแล้วที่ ${data.zone}/${data.slot_code}`,data.status!=='pending');
  }
  function selectLocation(raw,rawScan=false) {
    selectedLocation=PKIncoming.exactLocation(raw,locations);
    if (!selectedLocation) status('incomingPutawayStatus','ไม่พบ Location ตรงตัวในผัง · ตรวจ QR ตำแหน่ง',true);
    else { if (rawScan) playScanSuccess(`location:${selectedLocation.zone}/${selectedLocation.slot}`); $('incomingLocationScan').value=PKBarcode.locationPayload(selectedLocation.zone,selectedLocation.slot);status('incomingPutawayStatus',`เลือก Location ${selectedLocation.zone}/${selectedLocation.slot} · ตรวจข้อมูลแล้วกดยืนยัน`); }
    updatePutaway();
  }
  $('incomingTagScan').addEventListener('change',event=>{armScanAudio();selectTag(event.target.value,true);});
  $('incomingTagScan').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();armScanAudio();selectTag(event.target.value,true);}});
  $('incomingLocationScan').addEventListener('change',event=>{armScanAudio();selectLocation(event.target.value,true);});
  $('incomingLocationScan').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();armScanAudio();selectLocation(event.target.value,true);}});
  $('incomingStorer').addEventListener('input',updatePutaway);
  $('incomingReceiveForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if (saving) return;
    const product=identifyProduct(),qty=Number($('incomingQuantity').value);
    if (!product||!Number.isFinite(qty)||qty<=0) {status('incomingReceiveStatus','กรุณาสแกนรหัสสินค้าที่พบในสต็อกและใส่จำนวนต่อพาเลตให้ถูกต้อง',true);return;}
    if ($('incomingManufacturedOn').value&&$('incomingExpiresOn').value&&$('incomingExpiresOn').value<$('incomingManufacturedOn').value) {status('incomingReceiveStatus','วันหมดอายุต้องไม่ก่อนวันที่ผลิต',true);return;}
    if (!supabaseClient) {status('incomingReceiveStatus','ยังไม่ได้เชื่อมต่อฐานข้อมูล',true);return;}
    saving=true;$('incomingCreate').disabled=true;
    status('incomingReceiveStatus','กำลังบันทึก FM-ST-011…');
    try {
      pendingCreateRequestId ||= crypto.randomUUID();
      const {data,error}=await supabaseClient.rpc('create_incoming_pallet',{
        p_receiving_no:$('incomingReceiptNo').value.trim(),p_supplier_name:$('incomingSupplier').value.trim(),
        p_product_code:product.code,p_product_name:product.name,p_lot_no:$('incomingLot').value.trim(),
        p_unit:$('incomingUnit').value.trim(),p_quantity:qty,p_received_on:$('incomingReceivedOn').value,
        p_manufactured_on:$('incomingManufacturedOn').value||null,p_expires_on:$('incomingExpiresOn').value||null,
        p_actor:$('incomingReceiver').value.trim(),p_request_id:pendingCreateRequestId});
      if(error) throw error;
      if(!data?.id) throw new Error('ผลการบันทึกไม่ครบ กรุณารีเฟรชตรวจทะเบียนก่อนลองใหม่');
      renderTag(data);
      pendingCreateRequestId=null;
      status('incomingReceiveStatus',`บันทึก FM-ST-011 แล้ว · สร้างป้าย FM-ST-019 ลำดับ ${data.running_no} · รอจัดเก็บ`);
      $('incomingProductCode').value='';$('incomingProductName').value='';$('incomingLot').value='';$('incomingQuantity').value='';
      selectedProduct=null;
      await refreshList();
    } catch(error) { status('incomingReceiveStatus','ยังยืนยันการบันทึกไม่ได้ · ตรวจทะเบียนก่อนลองซ้ำ: '+error.message,true); }
    finally {saving=false;$('incomingCreate').disabled=false;}
  });
  $('incomingPutaway').addEventListener('click',async()=>{
    if(saving||!selectedTag||!selectedLocation||!palletDataReady) {status('incomingPutawayStatus','กรุณารอโหลดข้อมูลพาเลตให้ครบ แล้วตรวจป้ายและ Location',true);return;}
    saving=true;updatePutaway();status('incomingPutawayStatus','กำลังบันทึก Location…');
    try {
      const {data,error}=await supabaseClient.rpc('putaway_incoming_pallet',{
        p_tag_id:selectedTag.id,p_zone:selectedLocation.zone,p_slot:selectedLocation.slot,p_actor:$('incomingStorer').value.trim()});
      if(error) throw error;
      if(!data?.slot||!data?.tag) throw new Error('ผลการบันทึกไม่ครบ กรุณารีเฟรชตรวจสอบก่อนลองใหม่');
      applyRemoteSlotRow(data.slot,{silent:true,force:true});
      refreshAfterRemoteChange(data.slot.zone,data.slot.slot_code);
      status('incomingPutawayStatus',`จัดเก็บ ${data.tag.product_code} ที่ ${data.tag.zone}/${data.tag.slot_code} แล้ว · ${data.tag.quantity} ${data.tag.unit}`);
      selectedTag=null;selectedLocation=null;$('incomingTagScan').value='';$('incomingLocationScan').value='';
      await refreshList();
    } catch(error) {
      status('incomingPutawayStatus',error.message?.includes('INCOMING_ALREADY_STORED')?'ป้ายนี้ถูกจัดเก็บแล้ว · รีเฟรชรายการเพื่อตรวจ Location':'บันทึก Location ไม่สำเร็จ: '+error.message,true);
    } finally {saving=false;updatePutaway();}
  });
  function printTag(tag) {
    if (!tag||typeof qrcode!=='function') {status('incomingReceiveStatus','สร้างป้าย QR ไม่ได้',true);return;}
    const qr=qrcode(0,'M');qr.addData(PKIncoming.tagPayload(tag.id));qr.make();
    const page=window.open('','_blank');
    if(!page){status('incomingReceiveStatus','เบราว์เซอร์ปิดกั้นหน้าพิมพ์ · กรุณาอนุญาตป๊อปอัป',true);return;}
    page.document.write(`<!doctype html><html lang="th"><meta charset="utf-8"><title>FM-ST-019 ${esc(tag.receiving_no)} / ${esc(tag.running_no)}</title><style>body{font:16px Arial,sans-serif;margin:22px}.tag{border:2px solid #222;padding:20px;max-width:540px}.tag svg{width:180px;height:180px}p{margin:7px 0}</style><div class="tag"><b>FM-ST-019 · ใบกำกับพาเลต</b><p>Receiving No.: ${esc(tag.receiving_no)} / Running No.: ${esc(tag.running_no)}</p><p>Supplier: ${esc(tag.supplier_name)}</p><p>Product: ${esc(tag.product_code)} · ${esc(tag.product_name)}</p><p>Lot: ${esc(tag.lot_no||'—')}</p><p>จำนวนต่อพาเลต: <b>${esc(tag.quantity)} ${esc(tag.unit)}</b></p><p>วันที่รับ: ${esc(tag.received_on)} · ผลิต: ${esc(tag.manufactured_on||'—')} · หมดอายุ: ${esc(tag.expires_on||'—')}</p>${qr.createSvgTag(4,2)}<p>${esc(PKIncoming.tagPayload(tag.id))}</p></div></html>`);
    page.document.close();page.focus();page.print();
  }
  $('incomingPrintTag').addEventListener('click',()=>printTag(lastCreated));
  $('incomingList').addEventListener('click',event=>{
    const print=event.target.closest('[data-print-tag]'),select=event.target.closest('[data-select-tag]');
    const rows=$('incomingList')._rows||[];
    if(print) printTag(rows.find(row=>row.id===print.dataset.printTag));
    if(select) {selectTag(PKIncoming.tagPayload(select.dataset.selectTag));$('incomingPutawayTitle').scrollIntoView({block:'start',behavior:'smooth'});}
  });
  $('incomingRefresh').addEventListener('click',refreshList);
  async function stopCamera() {
    const active=camera,wasRunning=cameraRunning;
    cameraGeneration++;camera=null;cameraRunning=false;cameraStarting=false;
    if(active&&wasRunning)try{await active.stop();}catch(_){}
    if(active)try{active.clear();}catch(_){}
    $('incomingCameraView').hidden=true;$('incomingCameraView').replaceChildren();$('incomingCameraStop').hidden=true;
  }
  async function useScan(target,raw) {
    if(scanning)return;scanning=true;
    try {
      if(target==='product'){$('incomingProductCode').value=raw;identifyProduct(true);}
      if(target==='tag')await selectTag(raw,true);
      if(target==='location')selectLocation(raw,true);
    } finally {scanning=false;}
  }
  async function startCamera(target) {
    if(cameraStarting||cameraRunning)return;
    armScanAudio();
    if(typeof Html5Qrcode==='undefined'){status('incomingListStatus','โหลดตัวอ่าน QR ไม่สำเร็จ กรุณารีเฟรช',true);return;}
    const generation=++cameraGeneration;cameraStarting=true;
    try {
      const reader=new Html5Qrcode('incomingCameraView',{formatsToSupport:[0,3,4,5,6,8,9,10,11,13,14]});
      camera=reader;$('incomingCameraView').hidden=false;
      await reader.start({facingMode:'environment'},{fps:8,qrbox:(w,h)=>({width:Math.min(w-20,320),height:Math.min(h-20,220)})},async decoded=>{
        if(scanning)return;
        await stopCamera();await useScan(target,decoded);
      },()=>{});
      if(generation!==cameraGeneration||camera!==reader){try{await reader.stop();}catch(_){}try{reader.clear();}catch(_){}return;}
      cameraRunning=true;$('incomingCameraStop').hidden=false;
      $('incomingCameraView').scrollIntoView({block:'nearest'});
    } catch(error){if(generation===cameraGeneration){await stopCamera();status('incomingListStatus','เปิดกล้องไม่ได้ · ตรวจสิทธิ์กล้องหรือใช้รูปภาพ: '+error,true);}}
    finally{if(generation===cameraGeneration)cameraStarting=false;}
  }
  for(const [id,target] of [['incomingProductCamera','product'],['incomingTagCamera','tag'],['incomingLocationCamera','location']])
    $(id).addEventListener('click',()=>startCamera(target));
  $('incomingCameraStop').addEventListener('click',stopCamera);
  for(const [id,target] of [['incomingProductImage','product'],['incomingTagImage','tag'],['incomingLocationImage','location']])
    $(id).addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      armScanAudio();
      await stopCamera();
      const reader=new Html5Qrcode('incomingCameraView');$('incomingCameraView').hidden=false;
      try{await useScan(target,await reader.scanFile(file,true));}
      catch(_){status('incomingListStatus','อ่าน QR จากรูปไม่ได้ · กรุณาถ่ายใหม่ให้คมชัด',true);}
      finally{try{reader.clear();}catch(_){}$('incomingCameraView').hidden=true;event.target.value='';}
    });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
  $('tabs').addEventListener('click',event=>{if(event.target.closest('.tab-btn')?.dataset.tab!=='incoming')stopCamera();});
  refreshList();
})();
