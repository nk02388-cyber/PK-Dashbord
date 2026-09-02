const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helper = html.match(/function zoomPortraitLayout\([^]*?\n\}/)[0];
const layout = vm.runInNewContext(`(${helper})`);
const fitSource = html.match(/function computeZoomFit\([^]*?\n\}/)[0];
const slots = [{ leftPct: 60, topPct: 40 }, { leftPct: 85, topPct: 43 }];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const [width, height] of [[890, 538], [320, 280], [700, 900]]) {
  const fit = vm.runInNewContext(`(${fitSource})('F')`, {
    ZONE_SLOTS: { F: slots }, ZONE_PINS: {}, FLOORPLAN_ZOOM_W: 4356,
    FLOORPLAN_ZOOM_H: 3366, ZOOM_MAX: 9,
    zoomViewport: { getBoundingClientRect: () => ({ width, height }) },
  });
  assert.ok(25 / 100 * 4356 * fit.scale <= height * .78 + 1e-7);
  assert.ok(3 / 100 * 3366 * fit.scale <= width * .78 + 1e-7);
  for (const [panX, panY] of [[0, 0], [80, -30], [-40, 65]]) {
    const l = layout(width, height, panX, panY);
    assert.equal(l.width, height); assert.equal(l.height, width);
    const toScreen = (x, y) => ({ x: width - y, y: x });
    const center = toScreen(l.width / 2 + l.panX, l.height / 2 + l.panY);
    close(center.x, width / 2 + panX); close(center.y, height / 2 + panY);
    const next = toScreen(l.width / 2 + 10, l.height / 2);
    close(next.x, width / 2); close(next.y, height / 2 + 10);
  }
}
assert.match(html, /zoomStage\.append\(zoomZoneBox, zoomZoneLabel, zoomSlotsLayer\)/);
assert.match(html, /zoomStage\.style\.backgroundPosition/);
console.log('PASS: zoom clockwise orientation, fit, screen-space pan, shared image/slot layer');
