const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const render = html.match(/function renderZoneSelector\([^]*?\n\}/)[0];
const escape = html.match(/function escapeHtml\([^]*?\n\}/)[0];
const map = JSON.parse(html.match(/const FLOOR_ZONE_MAP = (\{[^\n]+\});/)[1]);
map.U = map['U-1']; delete map['U-1'];
const entries = Object.entries(map);
const before = JSON.stringify(entries);
const buildings = vm.runInNewContext(html.match(/const AREA_BUILDINGS = \[[^]*?\n\];/)[0] + '\nAREA_BUILDINGS');
const result = vm.runInNewContext(`${escape}\n(${render})(entries, buildings)`, { entries, buildings });
const labels = [...result.matchAll(/<button\b[^>]*>([^<]+)<\/button>/g)].map(m => m[1]);
assert.equal(labels.length, 40);
assert.equal(new Set(labels).size, 40);
assert.deepEqual([...labels].sort(), Array.from(buildings.flatMap(building => building.zones)).sort());
assert.ok(labels.every(x => /^[A-Z](?:-1)?$/.test(x)), 'Only zone codes, no pallet identifiers');
assert.ok(labels.includes('C') && labels.includes('U'));
assert.equal((result.match(/aria-pressed="false"/g) || []).length, 40);
assert.match(result, /เลือกโซน · 40 โซน/);
assert.equal(JSON.stringify(entries), before);
const groupCodes = key => [...result.match(new RegExp(`data-building="${key}"[^]*?<\\/section>`))[0]
  .matchAll(/data-zone="([^"]+)"/g)].map(m => m[1]);
assert.deepEqual(groupCodes('new'), 'ABCDEFGHIJKLMNOPQRST'.split(''));
assert.deepEqual(groupCodes('old'), [...'ABCDEFGHIJKLMNOPQRS'].map(x => x + '-1').concat('U'));
assert.doesNotMatch(result, /data-building="unassigned"|ยังไม่ระบุคลัง/);
for (const code of ['T-1', 'V-1', 'W-1', 'X-1', 'Y-1', 'Z-1']) {
  assert.ok(!labels.includes(code), `${code} must not have a selector button`);
  assert.ok(Object.hasOwn(map, code), `${code} data must remain intact`);
}
const search = html.indexOf('id="floorplanSearch"');
const selector = html.indexOf('id="floorplanFallbackList"');
const plan = html.indexOf('id="floorplanImageWrap"');
assert.ok(search < selector && selector < plan, 'Selector must be below search and above map');
console.log('PASS: 40 assigned zone buttons, unassigned group removed, all 46 source zones preserved');
