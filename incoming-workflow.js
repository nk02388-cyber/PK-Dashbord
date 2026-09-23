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
  function searchProducts(query, products) {
    const normalize = value => String(value ?? '').trim().toLocaleLowerCase('th');
    const needle = normalize(query);
    if (!needle) return [];
    const catalog = new Map();
    for (const item of products || []) {
      const code = String(item.code ?? '').trim(), key = normalize(code);
      if (!key) continue;
      const name = String(item.name ?? '').trim();
      const searchName = String(item.search_name ?? item.searchName ?? item.name_search ?? '').trim();
      const unit = String(item.unit ?? '').trim();
      const previous = catalog.get(key);
      if (!previous) catalog.set(key, {code,name,searchName,unit});
      else {
        if (!previous.name && name) previous.name = name;
        if (!previous.searchName && searchName) previous.searchName = searchName;
        if (!previous.unit && unit) previous.unit = unit;
      }
    }
    return [...catalog.values()].map(item => {
      const code = normalize(item.code), name = normalize(item.name), searchName = normalize(item.searchName);
      let rank = Infinity;
      if (code === needle) rank = 0;
      else if (name === needle || searchName === needle) rank = 1;
      else if (code.startsWith(needle)) rank = 2;
      else if (name.startsWith(needle) || searchName.startsWith(needle)) rank = 3;
      else if (code.includes(needle)) rank = 4;
      else if (name.includes(needle) || searchName.includes(needle)) rank = 5;
      return {...item,rank};
    }).filter(item => Number.isFinite(item.rank))
      .sort((a,b) => a.rank-b.rank || a.code.localeCompare(b.code,'th',{numeric:true,sensitivity:'base'}));
  }
  function exactLocation(raw, locations) {
    const match = root.PKBarcode.resolveScan(raw, locations, []);
    return match.kind === 'location' ? {zone:match.zone, slot:match.slot} : null;
  }
  function quantityUnits(value) {
    const number=Number(value);
    const units=Math.round(number*1000);
    return Number.isFinite(number)&&number>0&&Number.isSafeInteger(units)&&Math.abs(number*1000-units)<1e-7 ? units : null;
  }
  function distributeQuantity(total,count) {
    const units=quantityUnits(total);
    if (units===null||!Number.isInteger(count)||count<1||count>100||units<count) return null;
    // Whole pieces stay whole; fractional quantities retain the database's 0.001 precision.
    const scale=units%1000===0 ? 1 : 1000;
    const pieces=scale===1 ? units/1000 : units;
    if (pieces<count) return null;
    const base=Math.floor(pieces/count),remainder=pieces%count;
    return Array.from({length:count},(_,i)=>(base+(i<remainder?1:0))/scale);
  }
  function validAllocation(total,values) {
    const units=quantityUnits(total);
    if (units===null||!Array.isArray(values)||!values.length||values.length>100) return false;
    const parts=values.map(quantityUnits);
    return parts.every(part=>part!==null)&&parts.reduce((sum,part)=>sum+part,0)===units;
  }
  // Each pallet has its own paper sheet; the four cut labels on that sheet share one QR.
  function labelSheets(tags) {
    return Array.isArray(tags) ? tags.map(tag=>Array(4).fill(tag)) : [];
  }
  const api = {tagPayload,parseTag,exactProduct,searchProducts,exactLocation,distributeQuantity,validAllocation,labelSheets};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PKIncoming = api;
})(typeof window !== 'undefined' ? window : globalThis);
