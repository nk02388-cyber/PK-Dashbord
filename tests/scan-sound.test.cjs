const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const incoming = fs.readFileSync(path.join(root, 'incoming-ui.js'), 'utf8');
const barcode = fs.readFileSync(path.join(root, 'barcode-ui.js'), 'utf8');
assert.match(html, /scan-sound\.js[^<]*<\/script>[\s\S]*barcode-ui\.js[\s\S]*incoming-ui\.js/);
assert.match(incoming, /PKScanSound\.success\(key\)/);
for (const kind of ['tag', 'location', 'product']) {
  assert.match(barcode, new RegExp(`PKScanSound\\.success\\(\`${kind}:`));
}
assert.match(barcode, /match\.kind === 'invalid'\) \{ message\(match\.reason,true\); return; \}/);

let now = 1000;
const tones = [];
class AudioContextMock {
  state = 'running';
  currentTime = 2;
  destination = {};
  createOscillator() {
    const tone = {frequency:{setValueAtTime(){}},connect(){},start(){tones.push(tone);},stop(){}};
    return tone;
  }
  createGain() { return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }
}
const sandbox = {window:{AudioContext:AudioContextMock}, Date:{now:()=>now}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'scan-sound.js'), 'utf8'), sandbox);
const sound = sandbox.window.PKScanSound;
sound.arm();
sound.success('product:123');
assert.equal(tones.length, 1);
assert.equal(tones[0].type, 'square');
sound.success('product:123');
assert.equal(tones.length, 1, 'one camera scan must not chirp repeatedly');
sound.success('location:A/A-01');
assert.equal(tones.length, 2, 'scanning a different label must chirp');
now += 601;
sound.success('location:A/A-01');
assert.equal(tones.length, 3, 'a later deliberate scan of the same label must chirp');
console.log('PASS: all QR workflows share one scanner chirp; repeated camera frames are quiet');
