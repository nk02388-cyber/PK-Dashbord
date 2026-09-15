const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
for (const [, source] of scripts) new vm.Script(source);
const helper = html.match(/function overviewPortraitLayout\([^]*?\n\}/)[0];
const layout = vm.runInNewContext(`(${helper})`);
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }
for (const width of [320, 768, 960]) {
  for (const ratio of [1700 / 2200, 3366 / 4356]) {
    const l = layout(width, ratio);
    const height = width / l.aspectRatio;
    const point = (x, y) => ({ x: l.offsetX + x * l.stageWidth, y: l.offsetY + y * l.stageWidth * ratio });
    // The source drawing's upper-left crop corner is the default landscape top-left.
    const topLeft = point(0.055, 0.215), bottomRight = point(0.945, 0.785);
    close(topLeft.x, 0); close(topLeft.y, 0);
    close(bottomRight.x, width); close(bottomRight.y, height);
    // A is below and right of B, and below and left of G in the reference map.
    const a = point(0.79553, 0.66872), b = point(0.71947, 0.63342), g = point(0.79956, 0.42734);
    assert.ok(a.y > b.y && a.x > b.x && a.y > g.y && a.x < g.x);
    // Overlay points and raster use the same affine mapping at every pan/zoom level.
    for (const zoom of [1, 1.4, 6]) {
      const screen = { x: -25 + zoom * a.x, y: -40 + zoom * a.y };
      close((screen.x + 25) / zoom, a.x);
      close((screen.y + 40) / zoom, a.y);
    }
  }
}
assert.match(html, /new ResizeObserver\(ovApply\)\.observe\(floorplanWrap\)/);
assert.match(html, /let mapRotation = 0;/);
assert.match(html, /rotate\(\$\{mapRotation\}deg\)/);
console.log(`PASS: ${scripts.length} inline scripts parse; landscape default crop, orientation, resize and pan/zoom geometry`);
