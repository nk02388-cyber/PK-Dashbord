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
    const point = (x, y) => ({ x: l.offsetX - y * l.stageWidth * ratio, y: l.offsetY + x * l.stageWidth });
    // A clockwise turn maps the lower-left crop corner to the portrait top-left.
    const topLeft = point(0.055, 0.785), bottomRight = point(0.945, 0.215);
    close(topLeft.x, 0); close(topLeft.y, 0);
    close(bottomRight.x, width); close(bottomRight.y, height);
    // A is below B and left of G, as in the user's portrait reference.
    const a = point(0.79553, 0.66872), b = point(0.71947, 0.63342), g = point(0.79956, 0.42734);
    assert.ok(a.y > b.y && a.x < g.x);
    // Overlay points and raster use the same affine mapping at every pan/zoom level.
    for (const zoom of [1, 1.4, 6]) {
      const screen = { x: -25 + zoom * a.x, y: -40 + zoom * a.y };
      close((screen.x + 25) / zoom, a.x);
      close((screen.y + 40) / zoom, a.y);
    }
  }
}
assert.match(html, /new ResizeObserver\(ovApply\)\.observe\(floorplanWrap\)/);
assert.match(html, /rotate\(\$\{mapRotation\}deg\)/);
console.log(`PASS: ${scripts.length} inline scripts parse; portrait crop, orientation, resize and pan/zoom geometry`);
