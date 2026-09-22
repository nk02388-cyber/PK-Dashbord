// Warehouse scans select context only; stock changes still require the existing reviewed form.
(() => {
  const $ = id => document.getElementById(id);
  const input = $('barcodeScanInput'), status = $('barcodeScanStatus');
  const selection = $('barcodeScanSelection'), view = $('barcodeCameraView');
  const startButton = $('barcodeCameraStart'), stopButton = $('barcodeCameraStop');
  const locations = Object.entries(ZONE_SLOTS).flatMap(([zone, slots]) => slots.map(slot => ({zone,slot:slot.code})));
  const printZone = $('barcodePrintZone');
  [...new Set(locations.map(loc => loc.zone))].sort((a,b) => a.localeCompare(b,'th',{numeric:true})).forEach(zone => {
    const option = document.createElement('option'); option.value = zone; option.textContent = zone; printZone.append(option);
  });
  let chosenLocation = null, chosenProduct = null, camera = null, cameraRunning = false;
  function products() {
    return [...(STOCK.items || []), ...Object.values(SLOT_ITEMS).flatMap(slots => Object.values(slots).flat())];
  }
  function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
  function showSelection() {
    selection.textContent = `ตำแหน่ง: ${chosenLocation ? chosenLocation.zone+'/'+chosenLocation.slot : 'ยังไม่สแกน'} · สินค้า: ${chosenProduct ? chosenProduct.code+' '+(chosenProduct.name || '') : 'ยังไม่สแกน'}`;
  }
  async function stopCamera() {
    if (cameraRunning && camera) { try { await camera.stop(); } catch (_) {} }
    cameraRunning = false; camera = null; view.hidden = true; view.replaceChildren();
    startButton.hidden = false; stopButton.hidden = true;
  }
  function openMatch() {
    if (!chosenLocation || !chosenProduct) return;
    const {zone,slot} = chosenLocation;
    $('tab-floorplan').click();
    openZoomModal(zone);
    openSlotEdit(zone,slot);
    const index = slotItemsFor(zone,slot).findIndex(item => String(item.code).trim().toUpperCase() === String(chosenProduct.code).trim().toUpperCase());
    if (index >= 0) {
      const row = fseItemsList.querySelectorAll('.fse-item-row')[index];
      row?.classList.add('barcode-match'); row?.scrollIntoView({block:'nearest'});
      showFseFeedback(`พบ ${chosenProduct.code} ใน ${zone}/${slot} · ตรวจนับยอดที่แสดงก่อนแก้ไข`);
    } else {
      fseAddCode.value = chosenProduct.code;
      autofillAddProductDetails();
      fseAddLotNo.focus();
      showFseFeedback(`ตำแหน่ง ${zone}/${slot} ยังไม่มี ${chosenProduct.code} · กรอก Lot วันที่ จำนวน และเอกสารรับก่อนบันทึก`);
    }
  }
  async function apply(raw) {
    const match = PKBarcode.resolveScan(raw,locations,products());
    input.value = '';
    if (match.kind === 'invalid') { message(match.reason,true); return; }
    if (match.kind === 'location') { chosenLocation = {zone:match.zone,slot:match.slot}; message(`อ่านตำแหน่ง ${match.zone}/${match.slot} แล้ว · สแกนสินค้า`); }
    if (match.kind === 'product') { chosenProduct = match.product; $('barcodePrintProductCode').value = match.product.code; message(`อ่านสินค้า ${match.product.code} แล้ว · สแกนตำแหน่ง`); }
    showSelection();
    if (chosenLocation && chosenProduct) { await stopCamera(); openMatch(); }
  }
  $('barcodeScanApply').addEventListener('click', () => apply(input.value));
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); apply(input.value); } });
  startButton.addEventListener('click', async () => {
    if (typeof Html5Qrcode === 'undefined') { message('โหลดตัวอ่านบาร์โค้ดไม่สำเร็จ กรุณารีเฟรช',true); return; }
    try {
      camera = new Html5Qrcode('barcodeCameraView', {formatsToSupport:[0,3,4,5,6,8,9,10,11,13,14]});
      view.hidden = false;
      await camera.start({facingMode:'environment'},{fps:8,qrbox:(w,h)=>({width:Math.min(w-20,320),height:Math.min(h-20,220)})},decoded => apply(decoded),()=>{});
      cameraRunning = true; startButton.hidden = true; stopButton.hidden = false;
      message('เล็งกล้องไปที่ QR หรือบาร์โค้ด');
    } catch (error) { await stopCamera(); message('เปิดกล้องไม่ได้ · ตรวจสิทธิ์กล้องหรือใช้รูปภาพ/เครื่องสแกน: '+error,true); }
  });
  stopButton.addEventListener('click',stopCamera);
  $('barcodeImageInput').addEventListener('change',async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (typeof Html5Qrcode === 'undefined') { message('โหลดตัวอ่านบาร์โค้ดไม่สำเร็จ',true); return; }
    await stopCamera();
    const reader = new Html5Qrcode('barcodeCameraView');
    view.hidden = false;
    try { await apply(await reader.scanFile(file,true)); }
    catch (_) { message('อ่านรหัสจากรูปไม่ได้ กรุณาถ่ายใหม่ให้ป้ายอยู่กลางภาพและคมชัด',true); }
    finally { try { reader.clear(); } catch (_) {} view.hidden = true; event.target.value = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  $('tabs').addEventListener('click',event => { if (event.target.closest('.tab-btn')?.dataset.tab !== 'barcode') stopCamera(); });
  function qrMarkup(payload) { const qr = qrcode(0,'M'); qr.addData(payload); qr.make(); return qr.createSvgTag(3,2); }
  function printLabels(title,labels) {
    const page = window.open('','_blank');
    if (!page) { message('เบราว์เซอร์ปิดกั้นหน้าพิมพ์ กรุณาอนุญาตป๊อปอัป',true); return; }
    page.document.write(`<!doctype html><html lang="th"><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.label{border:1px solid #333;padding:9px;text-align:center;break-inside:avoid}.label svg{width:100px;height:100px}.label b,.label small{display:block;margin:4px}</style><h2>${escapeHtml(title)}</h2><div class="grid">${labels}</div></html>`);
    page.document.close(); page.focus(); page.print();
  }
  $('barcodePrintLocations').addEventListener('click', () => {
    const zone = printZone.value, slots = locations.filter(loc => loc.zone === zone);
    if (!slots.length || typeof qrcode !== 'function') { message('ยังสร้างป้าย QR ไม่ได้',true); return; }
    const labels = slots.map(loc => {
      return `<div class="label"><div>${qrMarkup(PKBarcode.locationPayload(loc.zone,loc.slot))}</div><b>${escapeHtml(loc.zone)} / ${escapeHtml(loc.slot)}</b><small>PKLOC · ชั้น 2</small></div>`;
    }).join('');
    printLabels(`ป้ายตำแหน่งโซน ${zone}`,labels);
  });
  $('barcodePrintProduct').addEventListener('click', () => {
    const code = $('barcodePrintProductCode').value.trim();
    const product = products().find(item => String(item.code || '').trim().toUpperCase() === code.toUpperCase());
    if (!product || !code || typeof qrcode !== 'function') { message('ไม่พบรหัสสินค้าแบบตรงตัว กรุณาตรวจรหัสก่อนพิมพ์',true); return; }
    printLabels(`ป้ายสินค้า ${product.code}`,`<div class="label"><div>${qrMarkup(PKBarcode.productPayload(product.code))}</div><b>${escapeHtml(product.code)}</b><small>${escapeHtml(product.name || '')}</small></div>`);
  });
})();
