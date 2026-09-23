// FM-ST-011 receipt + FM-ST-019 pallet tag. A tag is received before it has a location.
(function (root) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const tagPayload = id => `PKTAG|${id}`;
  function parseTag(raw) {
    const parts = String(raw ?? '').trim().split('|');
    if (parts.length !== 2 || parts[0].trim().toUpperCase() !== 'PKTAG' || !uuid.test(parts[1].trim()))
      return null;
    return parts[1].trim().toLowerCase();
  }
  function exactProduct(raw, products) {
    const match = root.PKBarcode.resolveScan(raw, [], products);
    return match.kind === 'product' ? match.product : null;
  }
  function exactLocation(raw, locations) {
    const match = root.PKBarcode.resolveScan(raw, locations, []);
    return match.kind === 'location' ? {zone:match.zone, slot:match.slot} : null;
  }
  const api = {tagPayload,parseTag,exactProduct,exactLocation};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PKIncoming = api;
})(typeof window !== 'undefined' ? window : globalThis);
