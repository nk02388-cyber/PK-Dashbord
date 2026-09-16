const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('tablet floorplan reserves usable height for an open slot editor', () => {
  assert.match(html, /@media \(min-width: 641px\) and \(max-width: 900px\)/);
  assert.match(
    html,
    /\.floorplan-zoom-box:has\(\.floorplan-slot-edit:not\(\[hidden\]\)\) \.floorplan-zoom-viewport\s*\{[^}]*min-height:\s*180px/s
  );
  assert.match(
    html,
    /\.floorplan-slot-edit:not\(\[hidden\]\)\s*\{[^}]*flex:\s*0 0 220px;[^}]*min-height:\s*220px/s
  );
});
