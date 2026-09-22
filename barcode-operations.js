// Exact, local-only barcode resolution. Unrecognized codes are never treated as partial SKU matches.
(function (root) {
  const normalize = value => String(value ?? '').trim().toUpperCase();
  const locationPayload = (zone, slot) => `PKLOC|${zone}|${slot}`;
  const productPayload = code => `PKITEM|${code}`;
  function resolveScan(raw, locations, products) {
    const value = normalize(raw);
    if (!value) return {kind:'invalid', reason:'ยังไม่มีรหัสให้ตรวจ'};
    const parts = String(raw).trim().split('|');
    const explicitLocation = normalize(parts[0]) === 'PKLOC';
    const explicitProduct = normalize(parts[0]) === 'PKITEM';
    if ((explicitLocation && parts.length !== 3) || (explicitProduct && parts.length !== 2))
      return {kind:'invalid', reason:'รูปแบบ QR ไม่ถูกต้อง'};
    const locationMatches = locations.filter(loc => explicitLocation
      ? normalize(loc.zone) === normalize(parts[1]) && normalize(loc.slot) === normalize(parts[2])
      : !explicitProduct && (normalize(loc.slot) === value || normalize(`${loc.zone}/${loc.slot}`) === value));
    const productValue = explicitProduct ? normalize(parts[1]) : value;
    const productMatches = products.filter(product => (explicitProduct || !explicitLocation) &&
      [product.code,product.barcode,product.ean,product.gtin].some(code => code && normalize(code) === productValue));
    const productMap = new Map();
    productMatches.forEach(product => { const key = normalize(product.code); if (!productMap.has(key)) productMap.set(key,product); });
    const uniqueProducts = [...productMap.values()];
    if (locationMatches.length === 1 && !uniqueProducts.length) return {kind:'location', ...locationMatches[0]};
    if (uniqueProducts.length === 1 && !locationMatches.length) return {kind:'product', product:uniqueProducts[0]};
    if (locationMatches.length || uniqueProducts.length) return {kind:'invalid', reason:'รหัสนี้ตรงกับหลายรายการ กรุณาใช้ป้าย QR ที่ระบุประเภท'};
    return {kind:'invalid', reason:'ไม่พบรหัสนี้ในตำแหน่งหรือรายการสินค้า · ตรวจป้ายหรือข้อมูลสินค้า'};
  }
  const api = {resolveScan,locationPayload,productPayload};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PKBarcode = api;
})(typeof window !== 'undefined' ? window : globalThis);
