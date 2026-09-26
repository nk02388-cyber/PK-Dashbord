/* Scrap is an outbound pallet movement; it never changes the imported stock snapshot. */
const ScrapInventoryCore = (() => {
  const quantity = item => {
    const value = item?.remainingQty ?? item?.qty;
    return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  };
  function validate(item, details) {
    if (!item) return 'กรุณาเลือกสินค้าที่ต้องการตัดจำหน่าย';
    const available = quantity(item);
    if (available == null) return 'สินค้านี้ไม่มียอดคงเหลือที่ยืนยันได้ กรุณาตรวจข้อมูลพาเลตก่อน';
    const qty = Number(details.qty);
    if (details.qty === '' || !Number.isFinite(qty) || qty <= 0 || qty > available + 1e-8) return `จำนวนต้องมากกว่า 0 และไม่เกินยอดคงเหลือ ${available.toLocaleString('en-US')} ${item.unit || ''}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.date || '') || Number.isNaN(new Date(`${details.date}T12:00:00Z`).getTime())) return 'กรุณาระบุวันที่ให้ถูกต้อง';
    if (!String(details.reason || '').trim()) return 'กรุณาระบุเหตุผลการตัดจำหน่าย';
    if (!String(details.document || '').trim()) return 'กรุณาระบุเลขเอกสารอ้างอิง';
    if (!String(details.actor || '').trim()) return 'กรุณาระบุผู้ทำรายการ';
    return null;
  }
  function prepare(item, details, recordedAt = new Date().toISOString()) {
    const error = validate(item, details);
    if (error) throw new Error(error);
    const next = JSON.parse(JSON.stringify(item));
    const qty = Number(details.qty);
    next.remainingQty = Number((quantity(item) - qty).toFixed(8));
    next.scraps = [...(next.scraps || []), {
      date: details.date, qty, unit: item.unit || '', lotNo: item.lotNo || '',
      reason: String(details.reason).trim(), note: String(details.note || '').trim(),
      by: String(details.actor).trim(), reference: String(details.document).trim(),
      destination: 'Inventory Loss / Scrap', recordedAt
    }];
    return next;
  }
  return { quantity, validate, prepare };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ScrapInventoryCore;
