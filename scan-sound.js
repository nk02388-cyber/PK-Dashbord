// A short handheld-scanner chirp, shared by every QR/barcode workflow.
(() => {
  let audio = null, lastKey = '', lastAt = 0;
  function arm() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audio ||= new AudioContextClass();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      return audio;
    } catch (_) { return null; }
  }
  function success(key) {
    const context = arm();
    if (!context) return;
    if (context.state !== 'running') {
      context.resume().then(() => { if (context.state === 'running') success(key); }).catch(() => {});
      return;
    }
    const nowMs = Date.now();
    if (key === lastKey && nowMs - lastAt < 600) return;
    try {
      const tone = context.createOscillator(), volume = context.createGain(), now = context.currentTime;
      tone.type = 'square';
      tone.frequency.setValueAtTime(1900, now);
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.exponentialRampToValueAtTime(0.24, now + 0.004);
      volume.gain.setValueAtTime(0.24, now + 0.09);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);
      tone.connect(volume); volume.connect(context.destination);
      tone.start(now); tone.stop(now + 0.13);
      lastKey = key; lastAt = nowMs;
    } catch (_) {} // A device without audio must still be able to scan.
  }
  window.PKScanSound = {arm, success};
})();
