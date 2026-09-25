(() => {
  const KEY = 'pk-warehouse-elevator-intro-seen';
  const intro = document.getElementById('warehouseIntro');
  const main = document.getElementById('mainDashboard');
  const skipLink = document.querySelector('.skip-link');
  const replay = document.getElementById('warehouseTourReplay');
  const next = document.getElementById('warehouseTourNext');
  const skip = document.getElementById('warehouseTourSkip');
  const eyebrow = document.getElementById('warehouseTourEyebrow');
  const title = document.getElementById('warehouseTourTitle');
  const description = document.getElementById('warehouseTourDescription');
  const progressBar = document.getElementById('warehouseTourProgress');
  const fill = progressBar.querySelector('span');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let progress = 0;
  let closing = false;
  let touchY = null;
  let finishTimer = null;

  const stages = [
    {
      eyebrow: '01 / 03 · เตรียมขึ้นชั้น 2',
      title: 'จากกล่องลูกฟูก<br><em>สู่ชั้นสอง</em>',
      description: 'ตามคนเข็นกล่องเข้าลิฟต์สินค้า กดส่งขึ้นชั้น 2 แล้วเข้าสู่ข้อมูลคลังใน BCL WMS',
      action: 'เริ่มขนย้าย →',
    },
    {
      eyebrow: '02 / 03 · ลิฟต์สินค้า',
      title: 'เข็นกล่องเข้าลิฟต์<br><em>กดชั้นสอง</em>',
      description: 'จากจุดรับสินค้า กล่องลูกฟูกถูกส่งต่อไปยังพื้นที่จัดเก็บชั้น 2',
      action: 'ส่งขึ้นชั้น 2 →',
    },
    {
      eyebrow: '03 / 03 · ถึงชั้นสอง',
      title: 'ถึงจุดจัดเก็บ<br><em>พร้อมดูข้อมูลจริง</em>',
      description: 'เปิด BCL WMS เพื่อตรวจสถานะพื้นที่ สต็อก และงานรับเข้าในคลัง',
      action: 'เข้าสู่หน้าเว็บ →',
    },
  ];

  function setProgress(value) {
    if (closing || intro.hidden) return;
    progress = Math.min(1, Math.max(0, value));
    const stage = stages[progress < .34 ? 0 : progress < .69 ? 1 : 2];
    if (eyebrow.textContent !== stage.eyebrow) {
      eyebrow.textContent = stage.eyebrow;
      title.innerHTML = stage.title;
      description.textContent = stage.description;
      next.textContent = stage.action;
    }
    const percent = Math.round(progress * 100);
    fill.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', String(percent));
    window.dispatchEvent(new CustomEvent('warehouse-tour-progress', { detail: { progress } }));
    if (progress >= .985 && !finishTimer) finishTimer = window.setTimeout(finish, 720);
    if (progress < .985 && finishTimer) { window.clearTimeout(finishTimer); finishTimer = null; }
  }

  function finish() {
    if (closing || intro.hidden) return;
    closing = true;
    window.clearTimeout(finishTimer);
    finishTimer = null;
    try { sessionStorage.setItem(KEY, '1'); } catch (_) { /* Private mode still allows entry. */ }
    intro.classList.add('is-closing');
    window.dispatchEvent(new Event('warehouse-tour-close'));
    const complete = () => {
      intro.hidden = true;
      intro.classList.remove('is-closing');
      document.body.classList.remove('tour-open');
      document.documentElement.classList.remove('tour-pending');
      main.inert = false;
      if (skipLink) skipLink.inert = false;
      main.focus({ preventScroll: true });
      closing = false;
    };
    window.setTimeout(complete, reducedMotion.matches ? 0 : 560);
  }

  function show() {
    if (finishTimer) window.clearTimeout(finishTimer);
    finishTimer = null;
    closing = false;
    progress = 0;
    intro.hidden = false;
    intro.classList.remove('is-closing');
    document.documentElement.classList.add('tour-pending');
    document.body.classList.add('tour-open');
    main.inert = true;
    if (skipLink) skipLink.inert = true;
    eyebrow.textContent = stages[0].eyebrow;
    title.innerHTML = stages[0].title;
    description.textContent = stages[0].description;
    next.textContent = reducedMotion.matches ? 'เข้าสู่หน้าเว็บ →' : stages[0].action;
    fill.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', '0');
    window.dispatchEvent(new Event('warehouse-tour-open'));
    window.dispatchEvent(new CustomEvent('warehouse-tour-progress', { detail: { progress: 0 } }));
    next.focus({ preventScroll: true });
  }

  intro.addEventListener('wheel', event => {
    event.preventDefault();
    if (closing) return;
    const scale = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? window.innerHeight : 1;
    setProgress(progress + event.deltaY * scale / 1000);
  }, { passive: false });
  intro.addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY ?? null; }, { passive: true });
  intro.addEventListener('touchmove', event => {
    if (touchY === null) return;
    event.preventDefault();
    const y = event.touches[0]?.clientY ?? touchY;
    const delta = touchY - y;
    touchY = y;
    setProgress(progress + delta / Math.max(400, window.innerHeight));
  }, { passive: false });
  intro.addEventListener('touchend', () => { touchY = null; });
  document.addEventListener('keydown', event => {
    if (intro.hidden || closing) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(); return; }
    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault(); setProgress(progress + .22);
    } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault(); setProgress(progress - .22);
    }
  });
  next.addEventListener('click', () => {
    if (reducedMotion.matches || progress >= .68) { setProgress(1); return; }
    setProgress(progress + .35);
  });
  skip.addEventListener('click', finish);
  replay.addEventListener('click', show);
  window.warehouseTour = { show, finish, get progress() { return progress; } };

  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (_) { /* Show tour. */ }
  if (seen) document.documentElement.classList.remove('tour-pending');
  else show();
})();
