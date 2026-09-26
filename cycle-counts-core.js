/* Location-based cycle-count calculations. No inventory balance is changed here. */
const CycleCountCore = (() => {
  function todayIso(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function addDays(iso, days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + Number(days));
    return date.toISOString().slice(0, 10);
  }
  function nextDue(lastDate, frequency) {
    const days = Number(frequency);
    return Number.isInteger(days) && days > 0 && lastDate ? addDays(lastDate, days) : null;
  }
  function scheduleStatus(lastDate, frequency, today = todayIso()) {
    const days = Number(frequency);
    if (!Number.isInteger(days) || days <= 0) return { label: 'ไม่ตั้งรอบ', kind: 'muted', next: null };
    const next = nextDue(lastDate, days);
    if (!next) return { label: 'นับครั้งแรก', kind: 'due', next: null };
    if (next < today) return { label: 'เกินกำหนด', kind: 'overdue', next };
    if (next === today) return { label: 'ครบกำหนดวันนี้', kind: 'due', next };
    return { label: 'ตามกำหนด', kind: 'ok', next };
  }
  function snapshotZone(zone, slots, itemsBySlot, occupiedBySlot, remainingQty) {
    const rows = [];
    for (const slot of slots || []) {
      const slotCode = slot.code;
      const items = (itemsBySlot?.[slotCode] || []).filter(item => {
        const raw = remainingQty(item);
        return raw == null || raw === '' || !Number.isFinite(Number(raw)) || Number(raw) !== 0;
      });
      items.forEach((item, index) => {
        const raw = remainingQty(item);
        const value = raw == null || raw === '' ? null : Number(raw);
        rows.push({
          id: `${slotCode}:${index}`, slot: slotCode, type: 'item',
          code: String(item.code || ''), name: String(item.name || ''),
          lot: String(item.lotNo || ''), unit: String(item.unit || ''),
          expected: Number.isFinite(value) ? value : null, counted: ''
        });
      });
      if (!items.length && occupiedBySlot?.[slotCode] === 'occupied') {
        rows.push({ id: `${slotCode}:occupied`, slot: slotCode, type: 'occupied',
          code: '', name: 'ตำแหน่งมีสถานะใช้งาน แต่ไม่มีรายการสินค้า', lot: '',
          unit: 'พาเลต', expected: 1, counted: '' });
      }
    }
    return { zone, rows };
  }
  function countError(draft) {
    if (!String(draft?.countedBy || '').trim()) return 'กรุณาระบุชื่อผู้ตรวจนับ';
    if (!draft.rows?.length && !draft.confirmEmpty) return 'กรุณายืนยันว่าไม่มีสินค้าในโซนนี้';
    for (const row of draft.rows || []) {
      if (row.counted === '' || row.counted == null) return `กรุณากรอกจำนวนที่นับได้ในตำแหน่ง ${row.slot}`;
      const qty = Number(row.counted);
      if (!Number.isFinite(qty) || qty < 0) return `จำนวนที่นับได้ในตำแหน่ง ${row.slot} ไม่ถูกต้อง`;
      if (row.type === 'occupied' && ![0, 1].includes(qty)) return `สถานะพาเลตในตำแหน่ง ${row.slot} ต้องเป็น 0 หรือ 1`;
    }
    return null;
  }
  function countSummary(rows) {
    return (rows || []).reduce((summary, row) => {
      if (row.counted === '' || row.counted == null) return summary;
      summary.counted += 1;
      if (row.expected == null) summary.unknown += 1;
      else if (Number(row.counted) !== Number(row.expected)) summary.different += 1;
      return summary;
    }, { counted: 0, different: 0, unknown: 0 });
  }
  return { todayIso, addDays, nextDue, scheduleStatus, snapshotZone, countError, countSummary };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CycleCountCore;
