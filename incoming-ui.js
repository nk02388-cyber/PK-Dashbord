// Two-stage FM-ST-011 / FM-ST-019 flow. A receiving scan never changes pallet stock.
(() => {
  const $ = id => document.getElementById(id);
  const locations = Object.entries(ZONE_SLOTS).flatMap(([zone,slots]) => slots.map(slot => ({zone,slot:slot.code})));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const status = (id,text,error=false) => { $(id).textContent=text; $(id).dataset.error=String(error); };
  const today = new Date();
  $('incomingReceivedOn').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  let selectedProduct=null, selectedTag=null, selectedLocation=null, lastCreated=[], pendingCreateRequestId=null;
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
      // A short square-wave chirp is closer to a handheld barcode scanner than a soft sine tone.
      tone.type='square';
      tone.frequency.setValueAtTime(1900,now);
      volume.gain.setValueAtTime(0.0001,now);
      volume.gain.exponentialRampToValueAtTime(0.24,now+0.004);
      volume.gain.setValueAtTime(0.24,now+0.09);
      volume.gain.exponentialRampToValueAtTime(0.0001,now+0.125);
      tone.connect(volume);volume.connect(audio.destination);
      tone.start(now);tone.stop(now+0.13);
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
  function updateAllocation(reset=false) {
    const total=Number($('incomingQuantity').value),count=Number($('incomingPalletCount').value);
    const suggested=PKIncoming.distributeQuantity(total,count);
    if (!suggested) {
      $('incomingAllocation').textContent='กรอกจำนวนทั้งหมดและจำนวนพาเลต 1–100 ให้ถูกต้อง';
      return;
    }
    const existing=[...$('incomingAllocation').querySelectorAll('[data-pallet-qty]')];
    if (reset||existing.length!==count) {
      $('incomingAllocation').innerHTML=`<b>จำนวนต่อป้าย · ปรับแต่ละพาเลตได้ก่อนบันทึก</b><div class="incoming-allocation-grid">${suggested.map((qty,i)=>`<label>พาเลต ${i+1}/${count}<input type="number" min="0.001" step="0.001" inputmode="decimal" data-pallet-qty="${i}" value="${qty}"></label>`).join('')}</div><p id="incomingAllocationStatus"></p>`;
    }
    const values=[...$('incomingAllocation').querySelectorAll('[data-pallet-qty]')].map(input=>input.value);
    const valid=PKIncoming.validAllocation(total,values);
    const sum=values.reduce((n,v)=>n+(Number(v)||0),0);
    $('incomingAllocationStatus').textContent=`รวมจากป้าย ${sum.toLocaleString('th-TH',{maximumFractionDigits:3})} / ${total.toLocaleString('th-TH',{maximumFractionDigits:3})} ${$('incomingUnit').value.trim()}${valid?' · พร้อมบันทึก':' · ยอดรวมไม่ตรง'}`;
    $('incomingAllocationStatus').classList.toggle('incoming-allocation-error',!valid);
  }
  $('incomingQuantity').addEventListener('input',()=>updateAllocation(true));
  $('incomingPalletCount').addEventListener('input',()=>updateAllocation(true));
  $('incomingUnit').addEventListener('input',()=>updateAllocation());
  $('incomingAllocation').addEventListener('input',event=>{if(event.target.matches('[data-pallet-qty]'))updateAllocation();});
  function labelSequence(tag) { return `${tag.batch_index||1}/${tag.batch_total||1}`; }
  function renderTags(tags) {
    if (!tags?.length) return;
    lastCreated=tags;
    const first=tags[0];
    $('incomingTagReady').hidden=false;
    $('incomingTagReady').innerHTML=`<b>FM-ST-019 · ${esc(first.receiving_no)} · ${tags.length} ป้าย</b><br>${esc(first.product_code)} · ${esc(first.product_name)}<br>Running ${esc(labelSequence(first))} ถึง ${esc(labelSequence(tags.at(-1)))} · รวม ${esc(tags.reduce((sum,tag)=>sum+Number(tag.quantity),0))} ${esc(first.unit)}`;
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
    $('incomingList').innerHTML=rows.length?`<table><thead><tr><th>FM-ST-011 / Running</th><th>สินค้า</th><th>จำนวนในป้าย</th><th>สถานะ / Location</th><th>ป้าย FM-ST-019</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.receiving_no)} / ${esc(labelSequence(row))}</td><td>${esc(row.product_code)}<br>${esc(row.product_name)}</td><td>${esc(row.quantity)} ${esc(row.unit)}</td><td>${row.status==='stored'?`จัดเก็บ ${esc(row.zone)}/${esc(row.slot_code)}`:'รอจัดเก็บ'}</td><td><button type="button" data-print-tag="${esc(row.id)}">พิมพ์ป้าย</button> ${row.batch_id?`<button type="button" data-print-batch="${esc(row.batch_id)}">พิมพ์ทั้งชุด</button>`:''} ${row.status==='pending'?`<button type="button" data-select-tag="${esc(row.id)}">เลือกจัดเก็บ</button>`:''}</td></tr>`).join('')}</tbody></table>`:'ยังไม่มีป้ายรับเข้า';
    $('incomingList')._rows=rows;
  }
  function updatePutaway() {
    $('incomingPutawaySummary').innerHTML=selectedTag
      ? `<b>FM-ST-019 · ${esc(selectedTag.receiving_no)} / ${esc(labelSequence(selectedTag))}</b><br>${esc(selectedTag.product_code)} · ${esc(selectedTag.product_name)} · ${esc(selectedTag.quantity)} ${esc(selectedTag.unit)}<br>Location: ${selectedLocation?`${esc(selectedLocation.zone)}/${esc(selectedLocation.slot)}`:'ยังไม่สแกน'}`
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
    const product=identifyProduct(),qty=Number($('incomingQuantity').value),palletCount=Number($('incomingPalletCount').value);
    const quantities=[...$('incomingAllocation').querySelectorAll('[data-pallet-qty]')].map(input=>input.value);
    if (!product||!PKIncoming.validAllocation(qty,quantities)||quantities.length!==palletCount) {status('incomingReceiveStatus','กรุณาตรวจรหัสสินค้า จำนวนรวม จำนวนพาเลต และยอดในแต่ละป้ายให้ตรงกัน',true);return;}
    if ($('incomingManufacturedOn').value&&$('incomingExpiresOn').value&&$('incomingExpiresOn').value<$('incomingManufacturedOn').value) {status('incomingReceiveStatus','วันหมดอายุต้องไม่ก่อนวันที่ผลิต',true);return;}
    if (!supabaseClient) {status('incomingReceiveStatus','ยังไม่ได้เชื่อมต่อฐานข้อมูล',true);return;}
    saving=true;$('incomingCreate').disabled=true;
    status('incomingReceiveStatus','กำลังบันทึก FM-ST-011…');
    try {
      pendingCreateRequestId ||= crypto.randomUUID();
      const {data,error}=await supabaseClient.rpc('create_incoming_batch',{
        p_receiving_no:$('incomingReceiptNo').value.trim(),p_supplier_name:$('incomingSupplier').value.trim(),
        p_product_code:product.code,p_product_name:product.name,p_lot_no:$('incomingLot').value.trim(),
        p_unit:$('incomingUnit').value.trim(),p_total_quantity:qty,p_pallet_count:palletCount,p_quantities:quantities.map(Number),p_received_on:$('incomingReceivedOn').value,
        p_manufactured_on:$('incomingManufacturedOn').value||null,p_expires_on:$('incomingExpiresOn').value||null,
        p_actor:$('incomingReceiver').value.trim(),p_request_id:pendingCreateRequestId});
      if(error) throw error;
      if(!Array.isArray(data)||data.length!==palletCount||data.some(tag=>!tag.id)) throw new Error('ผลการบันทึกไม่ครบ กรุณารีเฟรชตรวจทะเบียนก่อนลองใหม่');
      renderTags(data);
      pendingCreateRequestId=null;
      status('incomingReceiveStatus',`บันทึก FM-ST-011 แล้ว · สร้างป้าย FM-ST-019 ${data.length} ป้าย · รอจัดเก็บ`);
      $('incomingProductCode').value='';$('incomingProductName').value='';$('incomingLot').value='';$('incomingQuantity').value='';
      $('incomingPalletCount').value='1';updateAllocation(true);
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
  function openPrintWindow() {
    const page=window.open('','_blank');
    if(!page) status('incomingReceiveStatus','เบราว์เซอร์ปิดกั้นหน้าพิมพ์ · กรุณาอนุญาตป๊อปอัป',true);
    return page;
  }
  function printTags(tags,page) {
    if(!page||!tags?.length||typeof qrcode!=='function') {page?.close();status('incomingReceiveStatus','สร้างป้าย QR ไม่ได้',true);return;}
    const labels=tags.map(tag=>{
      const qr=qrcode(0,'M');qr.addData(PKIncoming.tagPayload(tag.id));qr.make();
      return `<article class="tag"><header><b>FM-ST-019 · ป้ายกำกับพาเลต</b><strong>${esc(labelSequence(tag))}</strong></header><p>Receiving No.: <b>${esc(tag.receiving_no)}</b></p><p>Supplier: ${esc(tag.supplier_name)}</p><p>Product Code: <b>${esc(tag.product_code)}</b></p><p class="product-name">${esc(tag.product_name)}</p><p>Lot: ${esc(tag.lot_no||'—')}</p><p>จำนวนรวม: ${esc(tag.batch_total_quantity||tag.quantity)} ${esc(tag.unit)} · ${esc(tag.batch_total||1)} พาเลต</p><p>จำนวนในพาเลต: <b>${esc(tag.quantity)} ${esc(tag.unit)}</b></p><p>วันที่รับ: ${esc(tag.received_on)} · ผลิต: ${esc(tag.manufactured_on||'—')} · หมดอายุ: ${esc(tag.expires_on||'—')}</p><div class="qr">${qr.createSvgTag(3,1)}<small>${esc(PKIncoming.tagPayload(tag.id))}</small></div></article>`;
    });
    const sheets=[];for(let i=0;i<labels.length;i+=4)sheets.push(`<section class="sheet">${labels.slice(i,i+4).join('')}</section>`);
    page.document.write(`<!doctype html><html lang="th"><meta charset="utf-8"><title>FM-ST-019 ${esc(tags[0].receiving_no)} · ${tags.length} ป้าย</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font:9pt Arial,sans-serif;margin:0;color:#111}.sheet{width:190mm;height:277mm;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:5mm;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.tag{border:1.5px solid #111;padding:3mm;min-width:0;overflow:hidden;overflow-wrap:anywhere}.tag header{display:flex;justify-content:space-between;align-items:start;gap:3mm;border-bottom:1px solid #555;padding-bottom:2mm;font-size:10pt}.tag header strong{font-size:15pt;white-space:nowrap}.tag p{margin:2mm 0}.product-name{font-weight:700}.qr{text-align:center;margin-top:2mm}.qr svg{width:34mm;height:34mm}.qr small{display:block;font-size:6.5pt;overflow-wrap:anywhere}</style>${sheets.join('')}</html>`);
    page.document.close();page.focus();page.print();
  }
  $('incomingPrintTag').addEventListener('click',()=>printTags(lastCreated,openPrintWindow()));
  $('incomingList').addEventListener('click',async event=>{
    const print=event.target.closest('[data-print-tag]'),batch=event.target.closest('[data-print-batch]'),select=event.target.closest('[data-select-tag]');
    const rows=$('incomingList')._rows||[];
    if(print) printTags([rows.find(row=>row.id===print.dataset.printTag)],openPrintWindow());
    if(batch) {
      const page=openPrintWindow();if(!page)return;
      const {data,error}=await supabaseClient.from('incoming_pallets').select('*').eq('batch_id',batch.dataset.printBatch).order('batch_index',{ascending:true});
      if(error||!data?.length){page.close();status('incomingListStatus','โหลดป้ายทั้งชุดเพื่อพิมพ์ไม่ได้: '+(error?.message||'ไม่พบข้อมูล'),true);return;}
      printTags(data,page);
    }
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
