#!/usr/bin/env node
// Prepare a reviewed opening inventory for Odoo 19 from the dashboard JSON backup.
// This never writes to Odoo or the dashboard database.
import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputDir] = process.argv.slice(2);
if (!inputPath || !outputDir) {
  console.error('Usage: node tools/odoo-pallet-export.mjs pallet_status.json output-directory');
  process.exit(2);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!input.slot_items || typeof input.slot_items !== 'object' || Array.isArray(input.slot_items)) {
  throw new Error('Expected dashboard pallet_status JSON with slot_items');
}

const products = new Map();
const locations = new Map();
const counts = new Map();
const review = [];
const clean = value => String(value ?? '').trim();
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
function writeCsv(name, headers, rows) {
  const lines = [headers, ...rows].map(row => row.map(csv).join(','));
  fs.writeFileSync(path.join(outputDir, name), '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
}

for (const [zone, slots] of Object.entries(input.slot_items)) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) continue;
  for (const [slot, items] of Object.entries(slots)) {
    const location = `${clean(zone)}/${clean(slot)}`;
    locations.set(location, [clean(zone), clean(slot), location]);
    if (!Array.isArray(items)) {
      review.push([location, '', '', 'slot_items is not an array']);
      continue;
    }
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const code = clean(item.code);
      const name = clean(item.name);
      const lot = clean(item.lotNo);
      const unit = clean(item.unit);
      const raw = item.remainingQty ?? item.qty;
      const qty = Number(raw);
      if (!code || !name || !unit || raw === '' || raw == null || !Number.isFinite(qty) || qty < 0) {
        review.push([location, code, lot, 'missing code/name/unit or invalid remainingQty']);
        continue;
      }
      if (products.has(code)) {
        const prior = products.get(code);
        if (prior[1] !== name || prior[2] !== unit) {
          review.push([location, code, lot, `conflicting product name or unit: ${prior[1]} / ${prior[2]}`]);
          continue;
        }
      } else products.set(code, [code, name, unit]);
      const received = Number(item.qty);
      if (item.qty != null && Number.isFinite(received)) {
        let calculated = received;
        let validHistory = true;
        for (const [field, sign] of [['withdrawals', -1], ['returns', 1], ['transfersOut', -1], ['transfersIn', 1]]) {
          for (const movement of item[field] || []) {
            const amount = Number(movement.qty);
            if (!Number.isFinite(amount) || amount < 0 || (movement.unit && clean(movement.unit) !== unit)) validHistory = false;
            else calculated += sign * amount;
          }
        }
        if (!validHistory || Math.abs(calculated - qty) > 0.000001) {
          review.push([location, code, lot, `remaining quantity differs from movement history (${qty} vs ${validHistory ? calculated : 'invalid history'})`]);
          continue;
        }
      }
      const key = JSON.stringify([location, code, lot, unit]);
      const row = counts.get(key) || [location, code, lot, unit, 0, 0];
      row[4] += qty;
      row[5]++;
      counts.set(key, row);
    }
  }
}

fs.mkdirSync(outputDir, { recursive: true });
writeCsv('products.csv', ['Internal Reference', 'Name', 'Dashboard Unit'], [...products.values()].sort((a,b)=>a[0].localeCompare(b[0])));
writeCsv('locations.csv', ['Zone', 'Slot', 'Proposed Odoo Location'], [...locations.values()].sort((a,b)=>a[2].localeCompare(b[2])));
writeCsv('opening-counts.csv', ['Proposed Odoo Location', 'Internal Reference', 'Lot/PK No.', 'Dashboard Unit', 'Counted Quantity', 'Source Rows'], [...counts.values()].sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])));
writeCsv('review.csv', ['Proposed Odoo Location', 'Internal Reference', 'Lot/PK No.', 'Issue'], review);
console.log(JSON.stringify({products:products.size, locations:locations.size, counts:counts.size, review:review.length, output:path.resolve(outputDir)}, null, 2));
