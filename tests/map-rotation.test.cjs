const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = name => html.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const overview = vm.runInNewContext(`(${source('overviewPortraitLayout')})`);
const zoom = vm.runInNewContext(`(${source('zoomPortraitLayout')})`);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const angle of [0, 90, 180, 270]) {
  const turn = angle / 90, c = [1, 0, -1, 0][turn], s = [0, 1, 0, -1][turn];
  for (const [width, height] of [[320, 280], [960, 540], [700, 900]]) {
    const ratio = 1700 / 2200;
    const l = overview(width, ratio, angle);
    const corners = [[.055, .215], [.945, .215], [.055, .785], [.945, .785]].map(([x, y]) => ({
      x: l.offsetX + (c * x - s * y * ratio) * l.stageWidth,
      y: l.offsetY + (s * x + c * y * ratio) * l.stageWidth,
    }));
    close(Math.min(...corners.map(p => p.x)), 0);
    close(Math.min(...corners.map(p => p.y)), 0);
    close(Math.max(...corners.map(p => p.x)), width);
    close(Math.max(...corners.map(p => p.y)), width / l.aspectRatio);
    for (const [panX, panY] of [[0, 0], [80, -30], [-40, 65]]) {
      const z = zoom(width, height, panX, panY, angle);
      const [tx, ty] = [[0, 0], [width, 0], [width, height], [0, height]][turn];
      const x = z.width / 2 + z.panX, y = z.height / 2 + z.panY;
      close(tx + c * x - s * y, width / 2 + panX);
      close(ty + s * x + c * y, height / 2 + panY);
    }
    const fit = vm.runInNewContext(`(${source('computeZoomFit')})('F', ${angle})`, {
      ZONE_SLOTS: {F: [{leftPct:60, topPct:40}, {leftPct:85, topPct:43}]},
      ZONE_PINS:{}, FLOORPLAN_ZOOM_W:4356, FLOORPLAN_ZOOM_H:3366, ZOOM_MAX:9,
      zoomViewport:{getBoundingClientRect:() => ({width,height})},
    });
    assert.ok(.25 * 4356 * fit.scale <= (turn % 2 ? height : width) * .78 + 1e-7);
    assert.ok(.03 * 3366 * fit.scale <= (turn % 2 ? width : height) * .78 + 1e-7);
  }
}
const state = vm.createContext({mapRotation:90, ovReset(){}, zoomModal:{hidden:false}, currentZoomZone:'F', fitCalls:0});
vm.runInContext(`function resetZoomFit(){fitCalls++}\n${source('rotateFloorplan')}`, state);
for (const expected of [180,270,0,90]) { state.rotateFloorplan(); assert.equal(state.mapRotation, expected); }
assert.equal(state.fitCalls,4);
state.zoomModal.hidden=true;
state.rotateFloorplan();
assert.equal(state.fitCalls,4);
assert.match(html, /floorplanOverviewRotate'\)\.addEventListener\('click', rotateFloorplan\)/);
assert.match(html, /floorplanZoomRotate'\)\.addEventListener\('click', rotateFloorplan\)/);
assert.match(html, /zoomPanY, mapRotation\)/);
console.log('PASS: all four shared map rotations, crop bounds, pan direction, fit, full-turn cycle and both buttons');
